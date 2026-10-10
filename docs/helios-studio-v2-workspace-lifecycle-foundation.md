# Packet 80: workspace lifecycle transition foundation

Implements the first bounded slice of the [approved lifecycle policy](helios-studio-v2-workspace-lifecycle-decision.md). Jake approved October 8, 2026; policy PR #388 integrated at `aa3457bca84d402cae01fbe85f78e32335995d3a`, matching the reviewed policy tree. Phase 1 OPEN; production ON HOLD.

## Scope

Adds ACTIVE/SUSPENDED workspace state, monotonic revision, and an initially empty independent PlatformLifecycleOperator registry. The additive migration defaults every existing workspace to ACTIVE/revision zero. Operators default disabled. No enrollment, transition API, UI, real workspace change or production migration is introduced.

The internal transition core requires tenant mode and `STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED=true`, current independently enrolled operator authority, active account/home membership/home workspace, matching session version, required reason, target identity and expected revision. Tenant and diagnostic-support roles do not imply lifecycle authority. Sorted workspace locks precede account/membership/operator locks. The state/revision update and attributable audit commit atomically; audit failure rolls back the transition. Redundant, malformed, stale or overflow transitions fail closed. State checks default to compatibility behavior while the feature is off.

This packet deliberately qualifies the persisted state machine and transition core only. Request admission, public 503 handling, support integration, worker/provider admission and safety exceptions remain subsequent bounded packets. The feature must remain disabled for real use until those callers qualify. A passing helper is not workspace-wide enforcement.

## Evidence gates

Targeted executable tests cover default-off behavior, invalid inputs, additive migration preservation/FKs and the actual transition core against PGlite transactions, including audit rollback, revision conflict and separate authority. Disposable PostgreSQL qualification applies the checked-in migration over existing synthetic workspaces, compares declared schema/indexes/constraints, exercises both target directions, observed current-authority races, concurrent single-winner transitions, audit rollback and active-state restoration. Synthetic transition operators are removed afterward. No job, content, domain or credential is changed by a transition.

Exact-head regression/TypeScript/Chromium, isolated runtime and independent artifact download/hash/parse verification remain required before integration. No whole lifecycle or Phase 1 exit is claimed.
