# Synthetic generation recovery browser check

Run from the repository root after `npm ci --ignore-scripts`:

```sh
npx playwright install --with-deps chromium
npm run test:recovery-browser
```

The runner bundles the actual generation recovery panel and shared dialog with application CSS, serves the fixture on an ephemeral loopback port, runs Chromium assertions and closes the server/browser. It does not start Next.js or use a database, credentials or external providers. The fixture replaces fetch with synthetic responses. It is not an application route.

Checks cover explicit confirmation, initial focus, reverse-tab focus wrapping, Escape and focus restoration, duplicate confirmation clicks, preserved unsaved notes, version/run submission, stale review invalidation, denied access, unavailable recovery, success followed by a failed refresh, mobile horizontal overflow and runtime errors. Client/service/database tests provide separate evidence for authorization and atomicity. This fixture does not prove deployed authentication, actual Prisma behavior, live concurrency or production parity.

GitHub's V2 regression workflow runs this command on every matching branch push. A passing browser step is necessary regression evidence, not authorization to deploy.
