# Packet 56 — Host-independent recurring series calendars

The recovered development executor exposed an existing recurrence defect: a stored UTC date boundary was interpreted through the host's local date/time methods, then converted into the series timezone. Identical series settings could skip an occurrence or shift dates depending on the server's timezone. The unchanged authorization test reproduced one occurrence in Australia/Brisbane versus two in UTC.

Calendar arithmetic now uses UTC fields as a neutral representation of the stored date-only boundaries. The planner formats those calendar dates with UTC fields and applies the existing series-timezone conversion once. Creation defaults and initial planning horizon use the same calendar basis. Existing UTC-host behavior, recurrence caps, month-end clamping, timezone conversion, uniqueness and current-access locking are retained. No existing occurrence is rewritten or rescheduled, and no provider or publishing path is activated.

Independent Node processes load the actual planner, timezone conversion and series-create handler under UTC, Australia/Brisbane and America/Los_Angeles. They require identical exact timestamps through Denver's daylight-saving transition, Brisbane month-end schedules, stable retry identities, denial before planning, and identical create defaults/horizons. Existing calendar fixtures now explicitly encode the UTC calendar contract instead of depending on the host timezone.

The actual Next/PostgreSQL harness creates one series per synthetic company, verifies exact stored timestamps, rejects foreign series generation, proves retries add no rows, and observes a database lock wait before membership revocation to require a denied generation with unchanged occurrences. No schema or production changes. This does not change DST gap/overlap policy or repair historical schedules generated on a non-UTC host; any such repair requires separate evidence and scope.

Phase 1 remains open. Production ON HOLD.
