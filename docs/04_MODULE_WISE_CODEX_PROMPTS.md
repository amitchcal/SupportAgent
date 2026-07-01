# 04_MODULE_WISE_CODEX_PROMPTS.md

# Module-wise Codex Prompts

Use these prompts one by one. Do not ask Codex to build everything in one go. Keep each task focused and testable.

## How to Use These Prompts

For each prompt:
1. Paste the master context first or keep it in `docs/00_MASTER_CONTEXT_AND_AGENTS.md`.
2. Ensure `AGENTS.md` exists in repo root.
3. Paste the specific module prompt.
4. Ask Codex to inspect the repo first.
5. Ask Codex to implement, test, and summarize.

---

# Prompt 0: Repository Assessment

```md
You are working on a multi-tenant AI L0 support agent for engineering support.

Before coding, inspect the repository and produce an implementation assessment.

Read:
- AGENTS.md
- docs/00_MASTER_CONTEXT_AND_AGENTS.md
- docs/01_EPICS_USER_STORIES_MOSCOW.md
- docs/02_DATABASE_SCHEMA.md
- docs/03_API_SPECIFICATION.md

Tasks:
1. Identify the current framework, package manager, and project structure.
2. Identify whether the repo already has auth, database, API routes, UI components, and tests.
3. Recommend the exact implementation sequence for this repo.
4. List files that need to be created or modified.
5. Do not implement code yet unless the repo is empty and you need to scaffold the project.
```

---

# Prompt 1: Project Scaffold

```md
Build the initial project scaffold for the Generic AI L0 Support Agent.

Context:
- Multi-tenant AI support platform.
- First industry: Engineering / Industrial Support.
- Must support admin portal, chat support, knowledge base, SOPs, ticketing adapter, feedback, reports, and audit.
- Use TypeScript.
- Use the existing repo conventions if already present.

Tasks:
1. Create a clean folder/module structure.
2. Add shared types for tenant, user role, document status, SOP status, conversation status, ticket status, severity, and integration type.
3. Add environment variable example file.
4. Add a basic README with setup instructions.
5. Add or update AGENTS.md.
6. Add placeholder pages/routes for:
   - Admin dashboard
   - Chat support
   - Knowledge base
   - SOP builder
   - Ticketing integrations
   - Reports
7. Add tests or at least compile checks if the repo already supports them.

Do not implement AI logic yet.
Definition of done:
- App starts.
- Placeholder pages render.
- TypeScript compiles.
- Folder structure is ready for future modules.
```

---

# Prompt 2: Database and Prisma Schema

```md
Implement the database schema for the Generic AI L0 Support Agent.

Read:
- docs/02_DATABASE_SCHEMA.md

Tasks:
1. Add or update Prisma schema for:
   - tenants
   - users
   - tenant_settings
   - business_hours
   - holidays
   - industries
   - products
   - assets
   - documents
   - document_versions
   - document_chunks
   - sop_definitions
   - sop_steps
   - sop_execution_logs
   - conversations
   - conversation_messages
   - attachments
   - voice_transcripts
   - ticketing_integrations
   - tickets
   - ticket_sync_logs
   - feedback
   - knowledge_gaps
   - audit_logs
2. Add enums as defined in the database document.
3. Add tenantId to every tenant-owned table.
4. Add indexes for tenantId, status, and common report queries.
5. Add seed script with:
   - Demo tenant
   - Super admin or tenant admin
   - Engineering industry template
   - Default tenant settings
   - Demo business hours
6. If vector support cannot be implemented directly in Prisma, add a clear migration note and service abstraction.

Definition of done:
- Prisma schema validates.
- Migration can be generated.
- Seed script runs.
- Tenant isolation is reflected in schema.
```

---

# Prompt 3: Authentication and RBAC

```md
Implement authentication and role-based access control.

Context:
The app has these roles:
- super_admin
- tenant_admin
- knowledge_manager
- support_supervisor
- integration_admin
- viewer
- api_user

Tasks:
1. Implement admin login.
2. Implement logout.
3. Implement /api/auth/me.
4. Add role-based route protection.
5. Add helper functions:
   - requireAuth()
   - requireRole()
   - requireTenantAccess()
6. Protect admin pages.
7. Create a basic admin layout that shows navigation based on role.
8. Add tests for unauthorized access and role restrictions.

Rules:
- Never trust tenantId from the client if it can be derived from session.
- Super Admin can access all tenants.
- Tenant users can access only their own tenant.

Definition of done:
- Admin can log in.
- Protected pages cannot be accessed anonymously.
- Role restrictions work.
- Tests cover core access rules.
```

---

# Prompt 4: Tenant Settings and Business Hours

```md
Implement tenant settings and business hours.

Tasks:
1. Build admin UI for tenant settings.
2. Build APIs:
   - GET /api/admin/tenant/settings
   - PATCH /api/admin/tenant/settings
3. Build business hours UI.
4. Build holiday configuration UI.
5. Implement support mode:
   - always_active
   - after_hours
   - when_human_unavailable
6. Add helper function:
   - isAISupportActive(tenantId, currentDateTime)
7. Audit all changes.

Acceptance criteria:
- Admin can update enabled languages.
- Admin can update required user fields.
- Admin can update AI confidence threshold.
- Admin can configure business hours.
- Changes are audited.
```

---

# Prompt 5: Chat Support MVP

```md
Implement the chat support MVP.

Tasks:
1. Build public support chat page/widget.
2. Implement POST /api/support/conversations.
3. Implement GET /api/support/conversations/{conversationId}.
4. Implement POST /api/support/conversations/{conversationId}/messages.
5. Store conversation and messages.
6. Support language selection: English, Hindi, Hinglish.
7. Capture user fields based on tenant settings.
8. Add a simple conversation state machine:
   - started
   - collecting_user_details
   - collecting_issue
   - clarifying
   - troubleshooting
   - confirming_resolution
   - creating_ticket
   - requesting_feedback
   - closed
9. For now, mock AI response with deterministic logic until AI service is implemented.
10. Add tests for conversation creation and message storage.

Definition of done:
- User can start chat.
- User can send and receive messages.
- Conversation is stored.
- Messages are stored.
- Language is stored.
```

---

# Prompt 6: AI Issue Capture and Classification

```md
Implement AI issue capture and classification service.

Tasks:
1. Create AIConversationService.
2. Create IssueClassificationService.
3. Extract from user message:
   - issue summary
   - category
   - subcategory
   - severity
   - urgency
   - safety risk
   - product/model/asset clues
   - error code
4. Implement engineering issue categories:
   - Mechanical
   - Electrical
   - Instrumentation
   - PLC/Automation
   - Hydraulic
   - Pneumatic
   - Calibration
   - Installation
   - Warranty
   - Spare Parts
   - Documentation
   - Preventive Maintenance
   - Safety
5. Implement safety keyword detection:
   - fire
   - smoke
   - burning smell
   - gas leak
   - chemical leak
   - electric shock
   - injury
   - explosion
   - emergency stop failure
   - high pressure leak
6. If safety risk is detected, return emergency_escalation.
7. Add tests for classification and safety detection.

Rules:
- Do not provide troubleshooting for emergency/safety risk.
- Store classification result on conversation.

Definition of done:
- Issue classification works.
- Safety detection works.
- Low confidence creates clarification path.
```

---

# Prompt 7: Knowledge Base Upload and Document Lifecycle

```md
Implement Knowledge Base document management.

Tasks:
1. Build admin Knowledge Base page.
2. Implement APIs:
   - POST /api/admin/documents
   - GET /api/admin/documents
   - GET /api/admin/documents/{documentId}
   - POST /api/admin/documents/{documentId}/approve
   - POST /api/admin/documents/{documentId}/archive
   - POST /api/admin/documents/{documentId}/versions
3. Support upload metadata:
   - title
   - description
   - category
   - productId
   - language
   - versionNumber
   - tags
4. Implement document statuses:
   - draft
   - pending_approval
   - active
   - archived
   - rejected
5. Implement file storage abstraction.
6. Implement text extraction abstraction.
7. Implement chunking service.
8. Ensure uploaded documents are not searchable until approved.
9. Audit upload, approval, archive, and version actions.
10. Add tests proving archived/draft documents are excluded from live retrieval.

Definition of done:
- Admin can upload document.
- Admin can approve document.
- Admin can archive document.
- New versions can be uploaded.
- Document lifecycle is audited.
```

---

# Prompt 8: Active-only RAG Retrieval

```md
Implement active-only knowledge retrieval.

Tasks:
1. Create KnowledgeRetrievalService.
2. Implement searchActiveKnowledge(input).
3. Ensure retrieval always filters:
   - tenantId
   - document.status = active
   - documentVersion.status = active
   - documentChunk.status = active
4. Add vector search if available; otherwise start with keyword search and keep vector abstraction.
5. Return top chunks with document metadata.
6. Log retrieved document IDs/chunk IDs in conversation message metadata.
7. Add tests:
   - active document is retrievable
   - archived document is not retrievable
   - draft document is not retrievable
   - another tenant’s document is not retrievable

Definition of done:
- AI support can only retrieve active approved tenant content.
- Tests prove forbidden documents are excluded.
```

---

# Prompt 9: SOP Builder and SOP Execution

```md
Implement SOP builder and SOP execution.

Tasks:
1. Build admin SOP list page.
2. Build create/edit SOP page.
3. Implement SOP APIs:
   - POST /api/admin/sops
   - GET /api/admin/sops
   - GET /api/admin/sops/{sopId}
   - POST /api/admin/sops/{sopId}/approve
   - POST /api/admin/sops/{sopId}/archive
4. Implement SOP step types:
   - ask_question
   - instruction
   - confirmation
   - measurement
   - upload_request
   - branch
   - safety_warning
   - escalate
   - resolve
5. Implement SOP execution service.
6. Implement API:
   - POST /api/support/conversations/{conversationId}/sop/{sopId}/step
7. Store SOP execution logs.
8. Ensure only active SOPs can be executed.
9. Ensure mandatory safety steps cannot be skipped.
10. Add tests for SOP flow and safety rule.

Definition of done:
- Admin can create SOP.
- Admin can approve SOP.
- AI/chat flow can execute SOP steps.
- SOP execution is logged.
```

---

# Prompt 10: Ticketing Adapter Layer

```md
Implement generic ticketing adapter layer.

Context:
Do not hardcode ServiceNow, Remedy, Jira, Zendesk, or Freshservice into core ticket logic.

Tasks:
1. Create NormalizedTicketPayload type.
2. Create TicketingAdapter interface:
   - testConnection()
   - createTicket(payload)
   - getTicketStatus(optional)
   - addComment(optional)
   - attachFiles(optional)
3. Create TicketingAdapterFactory.
4. Implement CustomWebhookAdapter first.
5. Implement ticketing integration database service.
6. Implement APIs:
   - GET /api/admin/integrations/ticketing
   - POST /api/admin/integrations/ticketing
   - POST /api/admin/integrations/ticketing/{integrationId}/test
7. Encrypt or safely store secrets.
8. Log all ticket sync attempts.
9. Add tests for adapter factory and webhook adapter.

Definition of done:
- Core code uses adapter interface only.
- Custom webhook integration can be configured.
- Connection test works.
- Sync logs are created.
```

---

# Prompt 11: Ticket Creation From Conversation

```md
Implement ticket creation from unresolved conversation.

Tasks:
1. Implement POST /api/support/conversations/{conversationId}/ticket.
2. Build TicketCreationService.
3. Generate normalized ticket payload from:
   - conversation
   - messages
   - issue classification
   - user details
   - asset/product details
   - troubleshooting steps
   - attachments
   - transcript summary
4. Use active ticketing integration for tenant.
5. Create external ticket through adapter.
6. Store ticket record and external ticket ID.
7. Update conversation status to ticket_created.
8. Return ticket reference to user.
9. If ticket creation fails:
   - store ticket with creation_failed or pending_creation
   - log error
   - show safe message
10. Add tests.

Definition of done:
- Unresolved conversation can create ticket.
- User receives ticket reference.
- Ticket payload includes troubleshooting history.
- Failures are stored and logged.
```

---

# Prompt 12: Feedback and Session Closure

```md
Implement feedback and session closure.

Tasks:
1. Implement POST /api/support/conversations/{conversationId}/resolve.
2. Implement POST /api/support/conversations/{conversationId}/feedback.
3. Add chat UI to ask:
   - Was your issue resolved?
   - Please rate this support experience.
   - Optional comment.
4. Ensure every completed session reaches one of:
   - resolved
   - ticket_created
   - abandoned
   - failed
   - escalated_without_ticket
5. Store feedback linked to conversation and ticket.
6. Flag negative feedback for review.
7. Add tests.

Definition of done:
- Issue cannot be marked resolved without user confirmation.
- Feedback is captured.
- Session final status is stored.
```

---

# Prompt 13: Basic Reporting Dashboard

```md
Implement basic reports and dashboard.

Tasks:
1. Build admin dashboard page.
2. Implement GET /api/admin/reports/performance.
3. Show:
   - total sessions
   - resolved sessions
   - ticket created sessions
   - abandoned sessions
   - resolution rate
   - escalation rate
   - average CSAT
   - top issue categories
   - language usage
   - voice/chat usage placeholder
4. Add date range filter.
5. Add category/language/status filters if easy.
6. Implement CSV export endpoint.
7. Audit report export.
8. Add tests for metrics calculation.

Definition of done:
- Supervisor can see performance metrics.
- Metrics match database records.
- CSV export works.
```

---

# Prompt 14: Conversation Review and Audit Logs

```md
Implement conversation review and audit logs.

Tasks:
1. Build admin conversation history page.
2. Implement GET /api/admin/conversations.
3. Implement GET /api/admin/conversations/{conversationId}.
4. Show:
   - user details
   - issue summary
   - messages
   - classification
   - SOP steps
   - ticket link
   - feedback
5. Build audit log page.
6. Implement GET /api/admin/audit-logs.
7. Add filters for action, entity, actor, date.
8. Ensure only authorized roles can view logs.

Definition of done:
- Supervisor can review conversations.
- Admin can review audit logs.
- Tenant isolation is enforced.
```

---

# Prompt 15: Voice Support Foundation

```md
Implement the voice support foundation.

Tasks:
1. Create voice module structure.
2. Add voice session type using same conversation model with channel=voice.
3. Create SpeechToTextService abstraction.
4. Create TextToSpeechService abstraction.
5. Implement placeholder/mock providers first if real providers are not configured.
6. Store voice transcript in voice_transcripts table.
7. Add UI placeholder or API endpoint for voice message upload.
8. Ensure voice uses same AIConversationService as chat.
9. Add tests for transcript storage.

Definition of done:
- Voice module exists.
- Voice transcript can be stored.
- Voice channel can reuse support conversation logic.
```

---

# Prompt 16: Multilingual Expansion

```md
Expand multilingual architecture.

Tasks:
1. Create LanguageService.
2. Support language detection abstraction.
3. Support translation abstraction.
4. Preserve:
   - original user message
   - normalized internal message
   - reply language
5. Ensure English, Hindi, and Hinglish work in MVP.
6. Add configuration placeholders for:
   - German
   - French
   - Spanish
   - Chinese/Mandarin
   - Japanese
7. Add tests for message storage with original and normalized language.

Rules:
- Do not mistranslate technical terms.
- Ticket summary should support English plus original language.

Definition of done:
- Language service is modular.
- Conversation stores language metadata.
- Additional languages can be enabled later.
```

---

# Prompt 17: Knowledge Gap Detection

```md
Implement knowledge gap detection.

Tasks:
1. Create KnowledgeGapService.
2. Create knowledge gap when:
   - no active KB result is found
   - AI confidence is low
   - user gives negative feedback
   - issue is escalated due to missing knowledge
3. Group similar gaps where simple matching is possible.
4. Build admin Knowledge Gaps page.
5. Implement GET /api/admin/reports/knowledge-gaps.
6. Allow Knowledge Manager to mark a gap as reviewed.
7. Add tests.

Definition of done:
- Knowledge gaps are created automatically.
- Admin can view and review them.
```

---

# Prompt 18: End-to-End MVP Hardening

```md
Perform end-to-end MVP hardening.

Tasks:
1. Review all MVP flows:
   - chat start
   - user detail capture
   - issue capture
   - classification
   - active KB retrieval
   - SOP execution
   - ticket creation
   - feedback
   - reports
2. Add missing validation.
3. Add missing tests.
4. Ensure tenant isolation.
5. Ensure archived documents are excluded.
6. Ensure unsafe troubleshooting is blocked.
7. Ensure all admin actions are audited.
8. Run lint, tests, and build.
9. Fix failures.
10. Produce a final MVP readiness report.

Definition of done:
- Build passes.
- Tests pass.
- Core flows work.
- Known limitations are documented.
```

---

# Prompt 19: Demo Data and Demo Script

```md
Create demo data and a demo script for Engineering L0 Support Agent.

Tasks:
1. Seed demo tenant.
2. Seed demo admin users.
3. Seed sample engineering products/assets.
4. Seed active SOP:
   - Compressor overheating basic L0 troubleshooting
5. Seed active KB document:
   - Compressor E-45 alarm explanation
6. Seed archived document:
   - Old compressor E-45 guide
7. Add test that archived guide is not retrieved.
8. Create DEMO_SCRIPT.md showing:
   - Admin uploads document
   - Admin approves document
   - User starts chat
   - User reports compressor issue
   - AI asks safety question
   - AI executes SOP
   - Issue unresolved
   - AI creates ticket
   - User gives feedback
   - Supervisor sees report

Definition of done:
- Demo can be run locally.
- Demo proves active-vs-archived document behavior.
```

---

# Prompt 20: Native Ticketing Adapter Example

```md
Implement one native ticketing adapter as an example after CustomWebhookAdapter is working.

Choose the adapter based on available credentials or tenant priority. If no credentials are available, implement the adapter interface and configuration UI but use mock tests.

Preferred order:
1. ServiceNow
2. Jira Service Management
3. Zendesk
4. BMC Helix / Remedy
5. Freshservice

Tasks:
1. Create adapter class implementing TicketingAdapter.
2. Add integration type to factory.
3. Add field mapping support.
4. Add connection test.
5. Add createTicket method.
6. Add tests using mocked API responses.
7. Do not expose secrets in logs.

Definition of done:
- Native adapter compiles.
- Unit tests pass.
- Core app still depends only on TicketingAdapter interface.
```
