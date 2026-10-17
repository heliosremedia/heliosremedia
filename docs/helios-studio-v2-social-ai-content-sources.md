# Packet 33: Social AI blog and newsletter source isolation

October 2, 2026. Fresh live base `147a78eabfde84cb65c22ecfd4ea86c76e694f16` is merged Packet 32 / PR #339, ahead of the supplied Packet 31 handoff. Exact-head regression 37043023521 remains successful at `2206f6ef968933cf829fcda14f4a4797110b98f6`. Charter, roadmap, ledger and coordination checkpoint independently reread. Production ON HOLD; Phase 1 remains open.

## Changes and checks

The composed Social AI harness now executes the actual blog/newsletter source readers and `getBlogOwnershipScope` in addition to the route, generation claim, source resolver, settings, normalization and grounding. Synthetic matching handles AND/OR and nested series ownership, and fixture cloning preserves dates. No application behavior or schema changes.

Eight additional cases bring the composed suite to twelve:

- BLOG and NEWSLETTER each run overlapping A/B generation with distinct fresh titles/subjects, content bodies and newsletter series names. Both generation and grounding prompts contain owned facts and omit foreign/cached markers. Company voice, callback output target, completion and duplicate replay retain the Packet 32 assertions.
- Both directions in each family reject a foreign source, missing ID, unpublished/unsent source and null ownership before provider calls or campaign/output mutation.
- Each family's legacy null-owned source is accepted only with tenant context disabled and a sole matching workspace. Tenant mode enabled, multiple workspaces, a sole different workspace and zero workspaces all reject it without side effects.

Temporarily removing the blog ownership clause and newsletter series ownership clause independently caused failures; original application source was restored. Twelve composed tests and six existing generation/source tests pass locally. TypeScript, scoped lint and whitespace pass. Exact-head regression and Chromium CI are required before integration; final evidence belongs on the PR and checkpoint.

## Evidence limits and protected systems

As in [Packet 32](helios-studio-v2-social-ai-isolation.md), authentication/current access, database execution/transactions and variant persistence remain synthetic adapters. Output assertions cover callback dispatch, not persisted output authorization. Providers remain fully stubbed with no network. This does not qualify PostgreSQL locks/rollback, hosted HTTP/session behavior, provider isolation, image generation, source changes during a pending provider response or all legacy Helios workflows.

No schema/migration, consent design, credentials, live provider, staging or production changes. The pending consent architecture decision is independent. Reverting this test/documentation packet on the non-production branch is the rollback. Next evidence gap: actual Social AI output persistence/authorization in a disposable database with provider responses stubbed.
