# Email Studio workspace

Email Studio uses task-first views while keeping the existing delivery APIs and campaign lifecycle unchanged.

## Reusable patterns

- `AdminWorkspaceTabs` provides associated tab/panel IDs, roving focus, and Arrow Left/Right, Home, and End navigation. The owning workspace keeps panels mounted with `hidden` so switching views preserves unsaved work. Keep hidden panels out of layout and the accessibility tree.
- `AdminSummaryCards` accepts an opt-in `compact` prop. Existing callers retain their original layout.
- Keep operational diagnostics in a separate view; surface a small count near that view when something needs review. Do not replace delivery events with optimistic success claims.
- Use small header shortcuts for related modules instead of placing navigation cards before the main task.

## Email-specific behavior

- Compose is the initial view. Campaigns has status filters and subject search across the existing recent-history result set. Delivery health retains provider reporting, webhook health, related cards, and saved card ordering.
- Audience → Message → Review & delivery remains the send workflow. Templates, AI assistance, images, personalization, draft actions, tests, scheduling, and sent snapshots are preserved.
- Switching views does not save or discard a draft. Reloading or leaving the page still requires saving through the existing draft action.
- The preview responds to the actual content width. At 52rem or wider it is a sticky rail; below that, the Write/Preview control stays available above the editor.
- Container-query containment belongs on the composer panel, never around viewport-fixed dialogs.
- Draft deep links restore their saved audience mode and selected recipients.

## Validation

Run `npm run lint`, `npm test`, `npm run test:email-ui`, and the build with the normal project configuration. Focused regression coverage is in `lib/email-studio-workspace.test.ts` and the existing Email Studio layout/formatting/image tests. The standalone render check covers actual React output for blank and restored drafts, recipient counts, tab associations, hidden panels, and the compact-summary opt-in.

For browser QA, use synthetic data in an isolated test environment. Check state retention across all views, keyboard navigation, filters/search, draft resume, template selection, personalization, responsive preview, expanded-preview dismissal, read-only campaign snapshots, and scheduling Cancel. Do not send or schedule real email during layout verification.
