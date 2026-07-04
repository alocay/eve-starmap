// Regenerates packages/core/src/data/defaultUniverseData.ts from the live EVE Online SDE.
//
// Data source (confirmed live, Task 9 Step 1, 2026-07-02):
// The riftforeve.online SDE mirror named in the plan turned out to be a *documentation*
// site only — https://sde.riftforeve.online/schema/mapSolarSystems/ etc. are schema docs
// pages (mkdocs-generated), not raw data endpoints. `curl`-ing them returns HTML, not
// JSONL. Those docs pages (and the site's homepage) link to the actual data, which CCP
// publishes as a single zip containing one .jsonl file per SDE table:
//   https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip
// (riftforeve.online also mirrors an "enhanced" copy with a few extra name fields we don't
// need for this dataset — see the "Downloads" section of https://sde.riftforeve.online/.)
// The Fuzzwork mirror (https://www.fuzzwork.co.uk/dump/latest/csv/) was also confirmed
// reachable and serves individual CSV tables directly (no zip needed), but its
// mapSolarSystems.csv only exposes the 3D `x,y,z` position, not a distinct 2D projected
// map position — so the CCP JSONL zip was used instead, since it has both.
//
// Confirmed field names (via the riftforeve.online schema docs):
//   mapSolarSystems.jsonl: { _key, name: {en, de, ...}, constellationID, regionID,
//                            position: {x,y,z} (3D, required),
//                            position2D: {x,y} (2D projected map position used by the
//                            in-game starmap; OPTIONAL — absent for wormhole-class
//                            systems, which have no 2D map projection) }
//   mapStargates.jsonl:    { _key, solarSystemID, destination: { solarSystemID, stargateID },
//                            position: {x,y,z} } — each record is one gate; solarSystemID is
//                            the system the gate sits in, destination.solarSystemID is the
//                            system it connects to. Gates come in reciprocal pairs (A->B and
//                            B->A both exist as separate records), which is fine here since
//                            StargateEdge doesn't need to be deduplicated.
//   mapRegions.jsonl:      { _key, name: {en, de, ...}, constellationIDs: [...],
//                            position: {x,y,z} (3D only -- no position2D, unlike systems) }
//                            Only id+name are used here; a region's 2D label position is
//                            derived at runtime (regionLabelLayer) from the centroid of its
//                            member systems' 2D positions, since regions have no 2D
//                            projected position of their own in the SDE.
//
// Run manually: node scripts/build-universe-data.js
// Requires network access. Downloads ~95MB (the full SDE zip) since CCP does not offer the
// jsonl tables individually — only three small parts of that zip end up in the output file.
// Not run automatically by any test or build; this is a manual maintenance step.

import { writeFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

const SDE_ZIP_URL = 'https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip'
const OUTPUT_PATH = new URL('../packages/core/src/data/defaultUniverseData.ts', import.meta.url)

/**
 * Minimal ZIP reader: extracts named entries from a ZIP archive buffer with no external
 * dependency. Supports the two compression methods CCP's build pipeline actually uses:
 * 0 (stored) and 8 (deflate). Not a general-purpose unzip implementation (no zip64
 * support, no data descriptors, no encryption) — sufficient for this one known archive.
 */
function extractFromZip(buffer, wantedNames) {
  const EOCD_SIG = 0x06054b50
  const CDH_SIG = 0x02014b50
  const LFH_SIG = 0x04034b50

  // Find the End Of Central Directory record by scanning backward for its signature.
  let eocdOffset = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) throw new Error('Not a valid ZIP file (no End Of Central Directory record found)')

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10)
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16)

  const found = new Map()
  let offset = centralDirOffset
  for (let i = 0; i < totalEntries && found.size < wantedNames.size; i++) {
    if (buffer.readUInt32LE(offset) !== CDH_SIG) {
      throw new Error(`Malformed ZIP central directory entry at offset ${offset}`)
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const fileNameLength = buffer.readUInt16LE(offset + 28)
    const extraFieldLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength)

    if (wantedNames.has(fileName)) {
      // Read the local file header to find where the actual entry data starts (its
      // filename/extra field lengths can differ in size from the central directory's).
      if (buffer.readUInt32LE(localHeaderOffset) !== LFH_SIG) {
        throw new Error(`Malformed ZIP local file header for ${fileName}`)
      }
      const lfhNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
      const lfhExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)
      const dataStart = localHeaderOffset + 30 + lfhNameLength + lfhExtraLength
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize)

      let data
      if (compressionMethod === 0) {
        data = compressed
      } else if (compressionMethod === 8) {
        data = inflateRawSync(compressed)
      } else {
        throw new Error(`Unsupported ZIP compression method ${compressionMethod} for ${fileName}`)
      }
      found.set(fileName, data)
    }

    offset += 46 + fileNameLength + extraFieldLength + commentLength
  }

  return found
}

function parseJsonl(buffer) {
  return buffer
    .toString('utf8')
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line))
}

async function main() {
  console.log(`Downloading SDE archive from ${SDE_ZIP_URL} ...`)
  const res = await fetch(SDE_ZIP_URL)
  if (!res.ok) throw new Error(`Failed to fetch ${SDE_ZIP_URL}: ${res.status}`)
  const zipBuffer = Buffer.from(await res.arrayBuffer())
  console.log(`Downloaded ${zipBuffer.length} bytes, extracting mapSolarSystems.jsonl, mapStargates.jsonl, and mapRegions.jsonl ...`)

  const entries = extractFromZip(zipBuffer, new Set(['mapSolarSystems.jsonl', 'mapStargates.jsonl', 'mapRegions.jsonl']))
  const solarSystemsData = entries.get('mapSolarSystems.jsonl')
  const stargatesData = entries.get('mapStargates.jsonl')
  const regionsData = entries.get('mapRegions.jsonl')
  if (!solarSystemsData) throw new Error('mapSolarSystems.jsonl not found in SDE archive')
  if (!stargatesData) throw new Error('mapStargates.jsonl not found in SDE archive')
  if (!regionsData) throw new Error('mapRegions.jsonl not found in SDE archive')

  const rawSystems = parseJsonl(solarSystemsData)
  const rawStargates = parseJsonl(stargatesData)
  const rawRegions = parseJsonl(regionsData)

  // Only systems with a 2D projected position are placed on the in-game starmap.
  // Wormhole-class systems (and a handful of other special systems) have a 3D
  // `position` but no `position2D`, and are excluded from this 2D starmap dataset.
  const systems = rawSystems
    .filter(s => s.position2D != null)
    .map(s => ({
      id: s._key,
      name: s.name.en,
      constellationId: s.constellationID,
      regionId: s.regionID,
      x: s.position2D.x,
      y: s.position2D.y,
    }))

  const systemIds = new Set(systems.map(s => s.id))

  const stargates = rawStargates
    .map(g => ({
      fromSystemId: g.solarSystemID,
      toSystemId: g.destination.solarSystemID,
    }))
    // Defensive: drop any gate touching a system excluded above (shouldn't happen in
    // practice -- wormhole systems don't have stargates -- but guarantees the output
    // passes validateUniverseData's "stargate references existing system id" check).
    .filter(g => systemIds.has(g.fromSystemId) && systemIds.has(g.toSystemId))

  const regions = rawRegions.map(r => ({
    id: r._key,
    name: r.name.en,
  }))

  const output = `// AUTO-GENERATED by scripts/build-universe-data.js. Do not edit by hand.
// Source: CCP's official EVE Online Static Data Export (JSONL). See script header for
// details on the data source and field mapping used to generate this file.
import type { UniverseData } from '../types.js'

export const defaultUniverseData: UniverseData = ${JSON.stringify({ systems, stargates, regions }, null, 2)}
`

  writeFileSync(OUTPUT_PATH, output)
  console.log(`Wrote ${systems.length} systems, ${stargates.length} stargates, and ${regions.length} regions to ${OUTPUT_PATH.pathname}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
