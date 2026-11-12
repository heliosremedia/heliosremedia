# Helios AI migration candidate

Reconstructed on November 12, 2026 from main 67905a63fb7e9586ff87d58eb978c9a252dd3cc5. Published as draft PR #468; preview validation completed before production release.

## Scope

Writing defaults and Location retries change from gpt-5-mini to gpt-6-luna. Social grounding changes from gpt-4.1-mini to Luna with reasoning none only for the exact new default, preserving its prior non-reasoning 35-second/2500-token budget. Explicit existing overrides retain precedence. Shared Blog/Newsletter/Social images change from gpt-image-1.5 to gpt-image-2.6-flare with an optional OPENAI_IMAGE_MODEL override, truthful stored attribution, and model-neutral UI/audit text. Existing schema, prompts, validation, review gates and paid one-image request behavior remain unchanged.

## Verified configuration and release path

On November 12, signed-in Vercel dashboard inspection of heliosremedia project environment variables showed only OPENAI_API_KEY under OPENAI search, marked Secret for Production and Preview. Shared variables search returned no results. No model overrides are configured in that dashboard view, so source defaults apply to new deployments. No credentials were revealed or changed.

GitHub main 67905a6 has a successful heliosremedia Vercel status. PR 466 has a Ready preview. The normal GitHub path works independently of the Vercel connector's 404. The owner approved preview and production deployment. The protected preview was deployed through GitHub on commit 9a7b653 and passed real provider checks. Temporary diagnostics were removed before release.

## Live preview verification (November 12, 2026)

Existing project key successfully accessed both exact model IDs. Four explicit synthetic, admin-authenticated requests ran without asset/database writes or sends; ordinary sign-in created its normal auth audit entry. The temporary diagnostic page and endpoint were removed before release.

| Test | Result | Latency | Input/output tokens | Estimated USD |
| --- | --- | --- | --- | --- |
| Luna event invitation, default reasoning, strict JSON | Completed; supplied event/date/time/venue and RSVP preserved, no invented facts | 4.352s | 109 / 159 (84 reasoning) | 0.0000904 |
| Luna factual location copy, default reasoning, strict JSON | Completed; only supplied photography/floor-plan services and Example City | 2.668s | 114 / 146 (108 reasoning) | 0.0000844 |
| Luna no-reasoning strict JSON | Completed, factual output; reasoning none accepted | 1.703s | 82 / 34 (0 reasoning) | 0.0000252 |
| Flare medium WebP, 1536x1024, compression88, n1 | Completed; dimensions verified; realistic bright neutral living room visually reviewed, no logos/text/people | 8.376s | 56 text / 1132 image | 0.03424 |

Text total estimate: $0.0002000. Image estimate: (56×$5 +1132×$30)/1,000,000 = $0.03424. Image-output subtotal $0.03396 is below the old Image1.5 medium1536x1024 published ~$0.05 baseline. These usage-derived estimates are not invoice confirmation or a guarantee for every future prompt. Equal quality/dimensions do not guarantee equal token counts.

These are representative synthetic access/schema/factuality/visual smoke checks, not exhaustive production editorial benchmarks. Existing human review, validation and publishing/send gates remain in place. No unrequested high-cost Terra substitution was made.

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

Additional verified pricing sources:
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/image-generation#historical-output-costs

Temporary diagnostic verification: ESLint, standard build and seven mocked auth/preview/origin/fixed-request safety checks passed. Final release tree contains no diagnostic route or page.
