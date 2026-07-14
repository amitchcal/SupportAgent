# ResolveOps Support Agent

A multi-tenant L0 support application backed by Supabase PostgreSQL and Supabase Storage.

## Production configuration

Copy `.env.example` to `.env.local` for local development and configure the same values in Vercel. `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `TICKETING_SECRET`, `DATABASE_URL`, and `DIRECT_URL` are server-only secrets and must never use a `NEXT_PUBLIC_` prefix.

Create a **private** Supabase Storage bucket named `support-documents` (or set `SUPABASE_STORAGE_BUCKET` to another private bucket). Uploaded knowledge documents are stored at tenant-scoped object paths. The service-role key is used only by server actions; browsers never receive it.

Generate independent session and ticketing secrets with at least 32 random bytes. Production requests fail closed when the session secret or document-storage credentials are missing.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run build` always runs `npm run test:regression` first. A failed regression blocks local builds, Vercel builds, and the GitHub push/pull-request workflow. The regression suite covers tenant isolation, approved-only knowledge retrieval, safety escalation, SOP enforcement, ticket adapters, feedback, reporting, authentication security, rate limiting, and outbound integration protection.

## Industry templates

Platform owners can create reusable industry templates at `/admin/industry-templates`. A template contains issue categories, required support fields, default SOP types, severity rules and escalation behavior. Applying a template copies those defaults into a tenant, where authorized tenant administrators can customize them without changing the source template or another tenant.

## Two-way ticket status synchronization

Integration administrators configure provider polling at `/admin/ticket-sync` with an HTTPS endpoint and response status field path. Use `{externalId}` in the endpoint URL to place the provider ticket identifier in the path. Successful and failed pulls are recorded in tenant-scoped sync logs.

Providers can push status changes to `POST /api/ticketing/status`. Send JSON containing `tenantId`, `externalTicketId`, and `status`, and set `x-support-signature` to the hexadecimal HMAC-SHA256 of the exact request body using `TICKETING_WEBHOOK_SECRET`. Incoming status changes update ticket metadata but never mark the support conversation resolved without user confirmation.

## Resolved-ticket knowledge candidates

When an external ticket reaches a resolved, closed, completed, done or fixed status, the application creates one tenant-scoped KB candidate. Knowledge Managers review candidates at `/admin/kb-candidates`. Converting a candidate creates a source-linked draft document that is still excluded from live retrieval until its version is separately approved through the existing knowledge lifecycle. Candidate content excludes requester details and raw conversation transcripts.

## Local development

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
