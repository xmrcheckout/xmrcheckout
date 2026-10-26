# UI dependency maintenance

Use Node.js 24 LTS for local development and all Docker stages. Install from
the committed lockfile with `npm ci`. The Docker image builds with development
dependencies, but copies only production dependencies into the runtime stage.

`package.json` overrides `postcss-selector-parser` to 7.1.6 to fix
[GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
Tailwind CSS 3 and its `postcss-nested` dependency otherwise select version 6,
which remains affected. Keep this override until both dependencies accept a
patched version. Parser 7 changes insertion behavior during iteration; verify
the generated CSS when updating it or its consumers.

After dependency changes, run `npm audit`, `npm run lint`, and the Docker UI
build. Check that the production image starts and excludes development tools.
