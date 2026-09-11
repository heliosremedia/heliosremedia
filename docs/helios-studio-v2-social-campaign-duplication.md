# Social campaign duplication integrity

Draft implementation after #249. No production data, publishing job, integration or deployment was changed.

Duplication now revalidates the actor inside a transaction, locks the owned source campaign and checks its source project, linked projects and both campaign/variant media before creating a copy. Known foreign storage namespaces and hidden media are rejected. Project, portfolio, published-blog and sent-newsletter sources require one valid stored source ID; their facts are rebuilt through the transaction's owned queries. Malformed or currently unmodelled source-ID relationships fail closed.

The copy retains authored text, selected platforms, linked media ordering and crop/alt-text presentation. It starts as a draft without approval, publishing history or schedule. Unverified historical AI metadata and cover URLs are not copied; the editor must select a verified cover again. Existing campaigns remain unchanged.

Tests execute the actual duplication helper with fake persistence and cover revoked access, missing campaigns, foreign source/project/media, hidden media, bad storage prefixes, malformed and mismatched source IDs, unavailable sources, fresh facts and unapproved-copy behavior. They do not prove hosted transaction isolation or browser save/reopen behavior. Historical media attestation, source-row transfer races, complete source typing and owned AI-cover copying remain follow-up work.

Restoration note: the runtime generated Prisma client files successfully, then the process reported a cancelled network approval. No approval bypass or database connection was attempted. TypeScript validation must establish whether those local artifacts suffice; generation process exit is not recorded as a clean success.

Framework guidance: installed Next.js 16.2.10 was retained. Its recovered package did not contain the requested documentation files, so the official [Next.js data security guide](https://nextjs.org/docs/app/guides/data-security) was consulted for server-side authorization guidance.
