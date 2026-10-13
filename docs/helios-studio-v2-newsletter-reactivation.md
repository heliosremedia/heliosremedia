# Newsletter reactivation admission

Candidate implementation; qualification pending. Production ON HOLD. Lifecycle rollout stays default-off.

Implements the approved schedule policy for newsletter claim admission and the existing background SEND/GENERATE execution-access boundaries. An additive nullable Workspace.lastReactivatedAt records the database clock after transition locks, atomically with revision and audit. Existing workspaces retain null compatibility; schedules and approvals are not rewritten. Each claim transaction locks only its owning workspace before family rows, then rechecks state, cutoff, schedule identity, approval and PREPARED/UNCERTAIN restrictions. Equality and earlier due dates require explicit recovery. Default-off paths retain existing behavior.

The existing execution-access callers now recheck the scheduled-action boundary. Owned terminal job settlement remains available while suspended and remains fenced by claim token. Admin actions retain their current administrator authorization; this does not add a bulk recovery or automatic replay action.

Evidence to qualify: focused actual-SQL PGlite cases for future/overdue/equality, repeat reactivation, explicit rescheduling and uncertainty; atomic transition/audit cutoff rollback; actual disposable PostgreSQL SEND/GENERATE admission waits and suspension changes in both tenant directions; duplicate settlement and restoration; full regression, TypeScript, Chromium and independent artifact verification.

Bounds: discovery/enqueue can still record held jobs; it cannot use those to pass claim admission. Newsletter notification, other email/referral/social/AI families, in-flight external provider race semantics and whole lifecycle activation remain open. This bounded change does not certify all outbound paths or enable real lifecycle transitions. No providers, live databases, credentials, billing or external customers are touched.

Rollback: revert application commit while retaining the additive nullable column. Do not drop the column on a populated database. Migration rehearsal is restricted to the pre-existing disposable database harness.
