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
