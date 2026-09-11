# Baseline failure resolution

The seven failures recorded before V2 have been traced individually.

1. Operational controls: the test stopped at a hard-coded V1.9.4.8 assertion, before reaching its health checks. It now checks the admin label against the current version. Existing health-response assertions remain.
2. Project agents: Prisma formatting inserted alignment whitespace. The schema check now accepts whitespace while retaining all required snapshot fields, optional client identity, ordering, migration preservation and public fallback checks.
3. Release link: a real defect. The UI displayed V1.9.9 while linking V1.9.7. Derive the href from STUDIO_VERSION and verify that the linked release exists, matches, is LIVE and has a date. Historical release assertions remain.
4. Admin surfaces: testimonials now expose a Published checkbox and explicitly require body.published === true on creation. Historical snapshots now use the safe Markdown renderer. Tests check those boundaries and execute the renderer against raw script, image-event and javascript-link input instead of banning every use of dangerouslySetInnerHTML.
5. SEO contract: the URL helper was renamed to getCanonicalAbsoluteUrl. Updated that reference; image precedence, revision, image metadata and page integration assertions remain.
6. Twilight release: a test titled V1.9.4.1 incorrectly asserted the current release was V1.9.4.7. Removed those unrelated assertions. Historical Twilight title, order, date and LIVE status checks remain; current release correctness is covered by releases.test.ts.
7. Email preview: the inline preview is now in document flow with a separate expandable dialog. The obsolete sticky-class assertion was replaced with checks for those controls and absence of the old sticky behavior. Delivery-language and analytics assertions remain.

These are test-contract and version-link corrections. They do not certify browser layout, hosted database behavior, migrations, backup restoration or tenant isolation. No production deployment or data change was performed.
