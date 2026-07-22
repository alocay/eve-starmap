// Version-bumps, tags, and publishes eve-starmap + eve-starmap-react together.
//
// Both packages are always released at the same version (see git history: every
// release commit bumps them together, and eve-starmap-react's dependency on
// eve-starmap is pinned to match) -- this script encodes that convention instead
// of leaving it to be remembered by hand each time.
//
// Run manually: node scripts/release.js <patch|minor|major|<explicit-version>> [--yes]

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const CORE_DIR = `${ROOT}/packages/core`
const REACT_DIR = `${ROOT}/packages/react`
const CORE_PKG = `${CORE_DIR}/package.json`
const REACT_PKG = `${REACT_DIR}/package.json`

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts })
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

function runCapture(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', ...opts }).trim()
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`${question} [y/N] `)
  rl.close()
  return answer.trim().toLowerCase() === 'y'
}

async function main() {
  const args = process.argv.slice(2)
  const bump = args.find((a) => !a.startsWith('--'))
  const autoYes = args.includes('--yes') || args.includes('-y')

  if (!bump) {
    console.error('Usage: node scripts/release.js <patch|minor|major|<explicit-version>> [--yes]')
    process.exit(1)
  }

  const branch = runCapture('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT })
  if (branch !== 'main') {
    console.error(`Refusing to release from branch "${branch}" -- switch to main first.`)
    process.exit(1)
  }

  const dirty = runCapture('git', ['status', '--porcelain'], { cwd: ROOT })
  if (dirty) {
    console.error('Working tree is not clean -- commit or stash changes before releasing.')
    process.exit(1)
  }

  run('git', ['fetch', 'origin', 'main'], { cwd: ROOT })
  const behind = runCapture('git', ['rev-list', '--count', 'HEAD..origin/main'], { cwd: ROOT })
  if (behind !== '0') {
    console.error('Local main is behind origin/main -- pull before releasing.')
    process.exit(1)
  }

  console.log('\n== npm login ==')
  run('npm', ['login'])
  const whoami = runCapture('npm', ['whoami'])
  console.log(`Logged in to npm as ${whoami}`)

  console.log('\n== build + test ==')
  run('npm', ['run', 'build'], { cwd: ROOT })
  run('npm', ['test'], { cwd: ROOT })

  console.log(`\n== bumping packages/core to "${bump}" ==`)
  run('npm', ['version', bump, '--no-git-tag-version'], { cwd: CORE_DIR })
  const newVersion = readJson(CORE_PKG).version

  const existingTags = runCapture('git', ['tag', '-l', `v${newVersion}`], { cwd: ROOT })
  if (existingTags) {
    console.error(`Tag v${newVersion} already exists -- aborting before any package.json changes stick.`)
    run('git', ['checkout', '--', 'packages/core/package.json'], { cwd: ROOT })
    process.exit(1)
  }

  const reactPkg = readJson(REACT_PKG)
  reactPkg.version = newVersion
  reactPkg.dependencies['eve-starmap'] = `^${newVersion}`
  writeJson(REACT_PKG, reactPkg)

  console.log('\n== syncing package-lock.json ==')
  run('npm', ['install', '--package-lock-only'], { cwd: ROOT })

  console.log(`\nAbout to release eve-starmap + eve-starmap-react @ ${newVersion}:`)
  run('git', ['diff', '--', 'packages/core/package.json', 'packages/react/package.json'], { cwd: ROOT })

  if (!autoYes && !(await confirm(`Commit, tag, push, and publish v${newVersion}?`))) {
    console.log('Aborted -- reverting version bump.')
    run('git', ['checkout', '--', 'packages/core/package.json', 'packages/react/package.json', 'package-lock.json'], { cwd: ROOT })
    process.exit(1)
  }

  console.log('\n== commit + tag ==')
  run('git', ['add', 'packages/core/package.json', 'packages/react/package.json', 'package-lock.json'], { cwd: ROOT })
  run('git', ['commit', '-m', `chore: bump eve-starmap and eve-starmap-react to ${newVersion}`], { cwd: ROOT })
  run('git', ['tag', `v${newVersion}`], { cwd: ROOT })
  run('git', ['push', 'origin', 'main', '--follow-tags'], { cwd: ROOT })

  console.log('\n== publish eve-starmap ==')
  run('npm', ['publish', '--access', 'public'], { cwd: CORE_DIR })

  console.log('\n== publish eve-starmap-react ==')
  run('npm', ['publish', '--access', 'public'], { cwd: REACT_DIR })

  console.log(`\nDone. Released v${newVersion}:`)
  console.log(`  https://www.npmjs.com/package/eve-starmap/v/${newVersion}`)
  console.log(`  https://www.npmjs.com/package/eve-starmap-react/v/${newVersion}`)
}

main().catch((err) => {
  console.error(`\nRelease failed: ${err.message}`)
  process.exit(1)
})
