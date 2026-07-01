# 00_MASTER_CONTEXT_AND_AGENTS.md

# Generic AI L0 Support Agent — Master Context for Codex

## Product Vision

Build a generic AI-powered L0 support agent that can work across industries. The first industry template is Engineering / Industrial Support.

The product must support post-office-hours support through chat and voice. It must use approved SOPs and approved knowledge base documents to answer user queries, perform guided troubleshooting, and resolve issues where safe. If the AI agent cannot safely or confidently resolve the issue, it must raise a ticket in the configured external ticketing platform.

The system must support:
- Chat support
- Voice support
- Multilingual support
- SOP-based troubleshooting
- Knowledge base upload, approval, versioning, and archiving
- Ticketing integrations
- Feedback collection
- Agent performance reporting
- Admin portal
- Multi-tenant architecture
- Audit logs
- Safe fallback and escalation

## Initial Languages

MVP priority:
1. English
2. Hindi
3. Hinglish

Architecture must support later:
4. German
5. French
6. Spanish
7. Chinese / Mandarin
8. Japanese

## Initial Industry

Engineering / Industrial Support.

Initial issue examples:
- Equipment breakdown
- Machine alarm
- Motor issue
- Pump issue
- Compressor issue
- PLC / SCADA alarm
- Sensor issue
- Calibration problem
- Preventive maintenance query
- Spare part query
- Warranty query
- Drawing/manual request
- Installation support
- Commissioning support
- Service visit request
- Safety escalation

## Non-Negotiable Rules

1. The system must not use archived documents for live support.
2. The system must not use draft, rejected, or unapproved documents for live support.
3. The system must not provide unsafe engineering instructions unless they are explicitly present in an approved SOP.
4. The system must escalate immediately for safety-sensitive issues.
5. The system must ask for user confirmation before marking an issue resolved.
6. Every completed support session must request user feedback.
7. The ticketing logic must use an adapter pattern. Do not hardcode ServiceNow, Remedy, Jira, Zendesk, or Freshservice into the core business logic.
8. All admin changes must be audited.
9. All AI responses must be traceable to an SOP, active KB document, safe fallback, or escalation rule.
10. Low-confidence answers must not be forced. Ask clarification first; escalate if still unclear.
11. The app should be multi-tenant from the beginning.
12. Engineering industry should be a template, not hardcoded everywhere.

## Recommended MVP Stack

Use this stack unless the existing repository already has a different stack:

Frontend:
- Next.js with TypeScript
- React
- Tailwind CSS
- Component-based UI

Backend:
- Next.js API routes or a separate Node.js/NestJS API
- TypeScript
- REST APIs initially

Database:
- PostgreSQL
- Prisma ORM
- pgvector or equivalent vector extension for document retrieval

Background Jobs:
- BullMQ or a similar queue library
- Redis for queueing/retry if needed

AI/RAG:
- Provider abstraction layer
- Embedding service abstraction
- Chat completion service abstraction
- Retrieval service using active approved document chunks only

Storage:
- S3-compatible storage or local storage in dev
- Store uploaded files and generated transcripts

Auth:
- Role-based access control
- Admin, tenant admin, knowledge manager, support supervisor, integration admin, viewer

Testing:
- Unit tests for services
- API tests
- RAG retrieval rule tests
- Ticketing adapter tests
- Safety rule tests

## Repository Guidance

Create or update the following structure:

```txt
/
  AGENTS.md
  docs/
    00_MASTER_CONTEXT_AND_AGENTS.md
    01_EPICS_USER_STORIES_MOSCOW.md
    02_DATABASE_SCHEMA.md
    03_API_SPECIFICATION.md
    04_MODULE_WISE_CODEX_PROMPTS.md
    05_IMPLEMENTATION_SEQUENCE.md
    06_TESTING_ACCEPTANCE_CRITERIA.md
  src/
    app/
    components/
    modules/
      auth/
      tenants/
      chat/
      voice/
      ai/
      knowledge-base/
      sop/
      ticketing/
      feedback/
      reports/
      audit/
      admin/
    lib/
    server/
    types/
  prisma/
    schema.prisma
    migrations/
  tests/
```

If the repository already has a structure, adapt to the existing conventions instead of forcing this exact structure.

## Suggested AGENTS.md Content

Paste this into the repository root as `AGENTS.md`.

```md
# AGENTS.md

## Project

This repository implements a multi-tenant AI L0 support agent for chat and voice support. The first industry template is Engineering / Industrial Support.

## Critical Product Rules

- Never use archived documents for live AI support.
- Never use draft, rejected, or unapproved documents for live AI support.
- Never provide unsafe engineering instructions unless explicitly present in an approved SOP.
- Escalate immediately for safety-related issues.
- Always ask user confirmation before marking a support session as resolved.
- Always request feedback at the end of a completed session.
- Ticketing integrations must use an adapter pattern.
- Core ticketing logic must use a normalized internal ticket schema.
- All admin actions must be audited.
- Multi-tenant boundaries must be enforced at every database query and API endpoint.

## Coding Rules

- Use TypeScript.
- Prefer small, testable modules.
- Add tests for business rules.
- Add validation for all API inputs.
- Use explicit tenantId scoping.
- Never trust client-side tenant/user role values.
- Keep UI clean and admin-friendly.
- Use clear error messages.
- Add TODO comments only when strictly necessary and actionable.

## Before Making Changes

- Inspect existing project structure.
- Identify package manager and framework.
- Reuse existing conventions.
- Check available test/lint commands.
- Do not introduce unnecessary new dependencies.

## Definition of Done

A task is done only when:
- The feature works end to end.
- TypeScript passes.
- Tests are added or updated.
- Tenant isolation is preserved.
- Security-sensitive paths are validated.
- Admin actions are audited where applicable.
- The implementation does not violate product safety rules.
```

## Codex Working Style

For each task:
1. Read this master context first.
2. Read the specific module prompt.
3. Inspect the repository.
4. Propose a short implementation plan.
5. Implement in small commits/changes.
6. Add tests.
7. Run lint/tests/build if available.
8. Summarize changed files and remaining gaps.

## MVP Completion Definition

MVP is complete when:

- A user can start a chat session.
- The user can use English, Hindi, or Hinglish.
- The AI can capture and classify an engineering support issue.
- The AI retrieves from active approved documents only.
- The AI can execute an approved SOP.
- The AI refuses unsafe troubleshooting and escalates.
- The AI can create a ticket through a configured adapter.
- The user receives a ticket reference.
- The session ends with feedback.
- Admin can upload, approve, archive, and version documents.
- Admin can configure ticketing webhook.
- Supervisor can view basic reports.
- Audit logs exist for admin actions.
