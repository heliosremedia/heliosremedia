# Public and Studio layout boundary

Status: draft implementation, production held. Depends on #301. Phase 1 isolation and Phase 2 reliability exit gates remain open.

## Boundary and compatibility

The root layout now owns only the document, existing fonts, global stylesheet and viewport. It performs no settings, location, host, session or database lookup and emits no public metadata or tracking. Public routes live under the URL-neutral `app/(public)` group, whose nested layout retains the existing settings provider, canonical metadata, revisioned icons, escaped LocalBusiness/WebSite JSON-LD and public analytics initialization. All 27 existing public page patterns retain their URLs. Studio continues to use its authenticated workspace settings; sign-in and invitation entry do not require a registered public domain or working database. Studio metadata is explicitly noindex/nofollow.

The existing public footer sign-in entry uses a document navigation so that entry does not carry the public page's initialized third-party runtime into Studio. There is no global click interceptor, router workaround, or client-supplied path/workspace header policy. Arbitrary configurable cross-plane links and existing global analytics configuration remain a separate audit gate, not solved analytics isolation.

Tenant-mode public layout and location pages pass one authoritative workspace ID to related data reads. Location list/detail queries now require that workspace and do not use the global default or bundled Helios locations on missing content, unknown hosts or database failures. Legacy flag-off default/bundled fallback is preserved. Sitemap passes its resolved workspace into settings and location selection. Location slugs, storage references, administrative writes and all remaining global/default settings consumers still require broader review.

No schema, migration, provider, OAuth, token, customer record or production configuration changes. Route moves preserve public component contents except homepage import paths and the location context changes described above. The five paths changed by main commits after `a657aef` through `72dab34568cb6885f3e93b5ed9db38edca156835` were already identical in the V2 base before moving files. Featured-project ordering and recent portfolio spacing/gallery hotfixes are retained. Path-level comparison is not full draft-stack ancestry or merge verification.

## Verification

- Local full suite: 688 passed, 0 failed. Four new checks exercise actual layout/metadata helpers, URL inventory and isolated PGlite-backed location selection with narrow SQL adapters.
- Actual Next.js development-server HTTP check passed with deliberately unreachable loopback database URLs and synthetic configuration: unregistered-host sign-in and invitation render, public canonical/JSON-LD/tracking are absent, an invalid session redirects from Studio, and the unauthenticated featured-film API returns 401. Spoofed forwarded-host/workspace headers do not make sign-in load public data.
- `next typegen` and non-incremental TypeScript passed serially; scoped ESLint and whitespace passed. Running TypeScript concurrently with Next development generation initially exposed malformed generated `.next/dev/types` output. Only that generated output was moved aside and regenerated, without changing source or excluding types. CI keeps type generation/checking and server verification sequential.
- CI adds the same actual HTTP check plus Playwright Chromium sign-in navigation, focus, mobile overflow, no external requests and no mutations. Fresh CI browser results must be recorded in the ledger before this check is counted as passed. The existing recovery browser fixtures remain separate synthetic UI evidence.

The isolated runner refuses runtime environment files, supplies only synthetic server configuration, blocks browser mutations/external requests, and terminates its own server. It never submits login, accepts an invitation, contacts providers or uses a production database. It is not authenticated full-stack tenant QA, generated-Prisma/Neon integration, deployed public SEO parity, real uploads or production-build verification.

Installed Next.js route-group/layout documentation determined the shared document/nested-public boundary. Verification and CI guidance informed actual request checks with no deployment. React review retained existing component contents, accessible sign-in navigation and parallel independent reads after workspace resolution.

## Rollback and remaining gates

Rollback is a coordinated code revert of the route moves, root/public layout, import paths and caller changes. Never publish both old and grouped pages for the same URL. No database rollback is needed. Keep public and Studio entry points in the same tested release artifact, and verify direct and soft navigation, public sitemap/robots/canonicals, unknown hosts and error pages in a hosted preview before production.

Reverting the tenant location helper restores the known global fallback risk, so retain that fix or keep tenant mode off during rollback. Existing static Helios sign-in/error/not-found/Studio copy, global GA measurement ownership, configurable cross-plane navigation, robots/domain policy, settings defaults/cache ownership and location storage/slug administration remain open. Authenticated browser workflows, hosted database concurrency/restoration, old/new worker overlap, registry retention, public visual/SEO parity and Jake's QA/release decision remain mandatory. This change does not complete any phase or authorize production.
