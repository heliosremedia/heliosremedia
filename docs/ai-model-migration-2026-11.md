# Helios AI migration candidate

Reconstructed on November 12, 2026 from main 67905a63fb7e9586ff87d58eb978c9a252dd3cc5. Not published or deployed.

## Scope

Writing defaults and Location retries change from gpt-5-mini to gpt-6-luna. Social grounding changes from gpt-4.1-mini to Luna with reasoning none only for the exact new default, preserving its prior non-reasoning 35-second/2500-token budget. Explicit existing overrides retain precedence. Shared Blog/Newsletter/Social images change from gpt-image-1.5 to gpt-image-2.6-flare with an optional OPENAI_IMAGE_MODEL override, truthful stored attribution, and model-neutral UI/audit text. Existing schema, prompts, validation, review gates and paid one-image request behavior remain unchanged.

## Verified configuration and release path

On November 12, signed-in Vercel dashboard inspection of heliosremedia project environment variables showed only OPENAI_API_KEY under OPENAI search, marked Secret for Production and Preview. Shared variables search returned no results. No model overrides are configured in that dashboard view, so source defaults apply to new deployments. No credentials were revealed or changed.

GitHub main 67905a6 has a successful heliosremedia Vercel status. PR 466 has a Ready preview. The normal GitHub path works independently of the Vercel connector's 404. Publishing a branch/PR can automatically trigger a preview, so wait for the current preview approval before publishing. Production release requires separate applicable authorization and completion of the following gates.

## Pending release gates

- Verify existing OpenAI project access using an approved preview or other authorized test environment.
- Evaluate representative synthetic writing outputs for schemas, facts, tone, latency and token usage. Do not send messages, schedule events or publish content.
- Evaluate Image 2.6 Flare quality, latency and billed usage. The default complexity is high, so unchanged medium quality is not evidence of identical cost.
- Confirm source/defaults on the eventual release deployment; current dashboard settings do not prove historical deployment environment snapshots.
- No provider sample calls, production database mutations or credential changes have been made.

## Model choice and deadlines

Image 1.5 retires December 1, 2026; GPT-5 mini December 11, 2026; GPT-4.1 mini January 14, 2027. The recommended Terra replacement ($2/$12 per million input/output tokens) is substantially more expensive than GPT-5 mini ($0.25/$2). This candidate instead uses structured-output-compatible Luna ($0.10/$0.50), subject to real quality validation. Image 2.6 output token price is $30/million vs 1.5's $32, but token counts differ and per-image equivalence is unverified.

Sources verified November 12:
- https://developers.openai.com/api/docs/deprecations
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/models/gpt-5.6-terra
- https://developers.openai.com/api/docs/models/gpt-5-mini
- https://developers.openai.com/api/docs/models/gpt-image-2.6-flare
- https://developers.openai.com/api/reference/resources/images/methods/generate

## Validation

Focused migration/Event/Location/Social tests: 23 passed. Baseline main previously measured 707/714 with seven unrelated failures. Current full suite: 712/719 with the same seven baseline failures. Scoped ESLint passed. Standard Prisma/Next.js production build passed, including TypeScript and route generation, using dummy configuration and without production migrations. Evidence is included separately in the recovery package. Local-only artifacts previously disappeared after workspace recovery; preserve this package durably before handoff.
