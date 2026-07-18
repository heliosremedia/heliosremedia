# Helios Real Estate Media

The Helios public portfolio and protected Digital Asset Management workspace, built with Next.js, TypeScript, Prisma, PostgreSQL, and Cloudflare R2.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and complete the database and R2 values.
3. Generate a secure admin password hash with `npm run auth:hash-password`, then add the printed value to `.env`.
4. Create a random `AUTH_SECRET` containing at least 32 characters.
5. Apply migrations with `npx prisma migrate dev`.
6. Start the application with `npm run dev`.

The public site is available at `http://localhost:3000`. The protected workspace is available at `http://localhost:3000/admin` and redirects unauthenticated visitors to `/login`.

## Admin security

- Credentials are configured through `HELIOS_ADMIN_EMAIL` and `HELIOS_ADMIN_PASSWORD_HASH`; plaintext passwords are never stored.
- Sessions use signed, HTTP-only, same-site cookies and expire after twelve hours.
- Five failed attempts temporarily lock the account for fifteen minutes.
- Viewer accounts are blocked from mutating admin APIs.
- Authentication events are retained in the admin Activity log.

Never commit `.env`, database credentials, R2 secrets, `AUTH_SECRET`, or password hashes.
