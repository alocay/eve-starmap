# eve-starmap

Monorepo for `eve-starmap` (framework-agnostic Canvas 2D EVE Online starmap renderer) and `eve-starmap-react` (React wrapper).

- `packages/core` — see [packages/core/README.md](packages/core/README.md)
- `packages/react` — see [packages/react/README.md](packages/react/README.md)

## Development

npm install
npm test
npm run build

## Regenerating universe data

The bundled default dataset ships as a placeholder until `node scripts/build-universe-data.js` is run against a live SDE mirror — see `docs/superpowers/specs/2026-07-02-eve-starmap-design.md` and Task 9 of `docs/superpowers/plans/2026-07-02-eve-starmap-mvp.md` for details.

## License

MIT
