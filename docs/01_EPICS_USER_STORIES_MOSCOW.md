# 01_EPICS_USER_STORIES_MOSCOW.md

# Generic AI L0 Support Agent — Epics, User Stories and MoSCoW Priority

## MoSCoW Legend

- Must Have: Required for MVP.
- Should Have: Important but can follow MVP.
- Could Have: Useful enhancement.
- Won't Have Now: Explicitly excluded from MVP.

---

# Epic 1: Multi-Tenant Foundation

## Goal
Support multiple organizations safely, with isolated data, settings, users, documents, conversations, tickets, and reports.

## User Stories

### US-001: Create Tenant
Priority: Must Have  
As a Super Admin, I want to create a tenant so that each customer organization has isolated data and configuration.

Acceptance Criteria:
- Tenant has name, slug, status, timezone, default language, and branding fields.
- Tenant status can be active/inactive.
- All tenant-owned records include tenantId.
- TenantId cannot be spoofed from the client.

### US-002: Tenant Settings
Priority: Must Have  
As a Tenant Admin, I want to configure support behavior so that the AI agent follows my organization’s rules.

Acceptance Criteria:
- Tenant can configure business hours.
- Tenant can configure enabled languages.
- Tenant can configure required support fields.
- Tenant can configure escalation behavior.

### US-003: Tenant Isolation
Priority: Must Have  
As a tenant, I want my data isolated so that no other tenant can access it.

Acceptance Criteria:
- API queries are tenant-scoped.
- Admins can only see their tenant unless Super Admin.
- Tests verify tenant isolation.

---

# Epic 2: Authentication and Role-Based Access

## Goal
Secure the platform with proper user roles.

## Roles
- Super Admin
- Tenant Admin
- Knowledge Manager
- Support Supervisor
- Integration Admin
- Viewer
- API User

## User Stories

### US-004: Admin Login
Priority: Must Have  
As an admin, I want to log in securely so that I can manage the platform.

Acceptance Criteria:
- Login page exists.
- Auth session is maintained.
- Unauthorized users cannot access admin pages.

### US-005: Role-Based Access Control
Priority: Must Have  
As a Tenant Admin, I want to assign roles so that users only access relevant features.

Acceptance Criteria:
- Roles control access to modules.
- Knowledge Manager can manage documents but not integrations.
- Integration Admin can manage integrations.
- Support Supervisor can view reports and conversations.
- Viewer has read-only access.

### US-006: User Management
Priority: Must Have  
As a Tenant Admin, I want to invite and deactivate users.

Acceptance Criteria:
- Admin can add user.
- Admin can assign role.
- Admin can deactivate user.
- User changes are audited.

---

# Epic 3: Chat Support Session

## Goal
Allow end users to receive L0 support through chat.

## User Stories

### US-007: Start Chat Session
Priority: Must Have  
As an end user, I want to start a chat session so that I can report a support issue.

Acceptance Criteria:
- Chat widget/page exists.
- Session ID is created.
- Tenant context is identified.
- User can enter issue text.
- Conversation is stored.

### US-008: Language Selection
Priority: Must Have  
As a user, I want to select my preferred language so that I can communicate comfortably.

Acceptance Criteria:
- User can select English, Hindi, or Hinglish in MVP.
- Selected language is stored in session.
- AI replies in selected language.
- Architecture supports future languages.

### US-009: Capture User Details
Priority: Must Have  
As a support user, I want to provide my details so that ticketing and follow-up are possible.

Acceptance Criteria:
- System captures configurable fields.
- Required fields are validated.
- Details attach to conversation and ticket.

### US-010: Capture Issue Details
Priority: Must Have  
As a user, I want the agent to ask relevant questions so that the problem is properly understood.

Acceptance Criteria:
- Agent extracts issue summary, asset, model, serial number, error code, site, severity clues.
- Agent asks missing critical questions.
- Agent confirms issue summary before troubleshooting or ticket creation.

---

# Epic 4: AI Issue Classification and Safety

## Goal
Classify issues, detect safety risks, and avoid unsafe support.

## User Stories

### US-011: Classify Issue
Priority: Must Have  
As the system, I want to classify support issues so that the right SOP or escalation path is chosen.

Acceptance Criteria:
- Issue category is assigned.
- Severity is assigned.
- Confidence is recorded.
- Classification result is stored.

### US-012: Detect Safety Risk
Priority: Must Have  
As the system, I want to detect emergency or unsafe scenarios so that the user is not guided into danger.

Acceptance Criteria:
- Safety keywords are detected.
- Safety issue bypasses normal troubleshooting.
- System creates critical escalation.
- Unsafe troubleshooting is blocked.

### US-013: Low Confidence Fallback
Priority: Must Have  
As the system, I want to avoid guessing when confidence is low.

Acceptance Criteria:
- If confidence is below threshold, ask clarification.
- If still low, escalate.
- Low confidence reason is stored.

---

# Epic 5: Knowledge Base Management

## Goal
Allow admins to upload, approve, version, archive, and retrieve support documents safely.

## User Stories

### US-014: Upload Document
Priority: Must Have  
As a Knowledge Manager, I want to upload support documents so that the AI can use approved knowledge.

Acceptance Criteria:
- User can upload PDF, DOCX, TXT, MD, HTML.
- Metadata is captured.
- Document is draft or pending approval by default.
- Document is not used until approved.

### US-015: Approve Document
Priority: Must Have  
As an Admin, I want to approve documents so that they become available for live support.

Acceptance Criteria:
- Admin can approve pending document.
- Status changes to active.
- Approved timestamp and approver are stored.
- Active document is indexed for retrieval.

### US-016: Archive Document
Priority: Must Have  
As an Admin, I want to archive outdated documents so that old content is not used.

Acceptance Criteria:
- Admin must provide archive reason.
- Status changes to archived.
- Archived document is excluded from live retrieval.
- Archived document remains available for audit.

### US-017: Version Document
Priority: Must Have  
As a Knowledge Manager, I want to upload a new version so that the current version can be replaced safely.

Acceptance Criteria:
- Version history is maintained.
- New version starts as draft/pending approval.
- Only approved version can become active.
- Old version can be archived.

### US-018: Retrieve Only Active Content
Priority: Must Have  
As the AI engine, I must retrieve only active approved documents.

Acceptance Criteria:
- Retrieval query filters status=active.
- TenantId is always included.
- Archived, draft, rejected documents are excluded.
- Tests verify this rule.

---

# Epic 6: SOP Engine

## Goal
Create and execute safe, structured troubleshooting flows.

## User Stories

### US-019: Create SOP
Priority: Must Have  
As an Admin, I want to create an SOP so that the AI can follow approved troubleshooting steps.

Acceptance Criteria:
- SOP has title, category, product, language, status, version.
- SOP has ordered steps.
- SOP starts as draft/pending approval.
- SOP can be activated.

### US-020: SOP Step Types
Priority: Must Have  
As an Admin, I want different SOP step types so that troubleshooting can branch.

Supported step types:
- ask_question
- instruction
- confirmation
- measurement
- upload_request
- branch
- safety_warning
- escalate
- resolve

Acceptance Criteria:
- Steps are stored with order.
- Steps support expected response formats.
- Branching is supported.

### US-021: Execute SOP
Priority: Must Have  
As a user, I want the AI to guide me step by step.

Acceptance Criteria:
- System executes active SOP only.
- User confirms each step.
- System logs step execution.
- SOP can end in resolved or escalated.

### US-022: Block Unsafe SOP Actions
Priority: Must Have  
As the system, I want to enforce safety restrictions.

Acceptance Criteria:
- Safety step cannot be skipped.
- Unsafe operation without approved SOP is refused.
- Emergency escalation overrides SOP.

---

# Epic 7: Ticketing Integration

## Goal
Create external tickets when AI cannot resolve the issue.

## User Stories

### US-023: Normalized Ticket Payload
Priority: Must Have  
As a developer, I want a normalized internal ticket schema so that multiple ticketing systems can be supported.

Acceptance Criteria:
- Internal ticket schema exists.
- Ticket payload includes user, asset, issue, troubleshooting, attachments, transcript.
- Ticket payload is independent of external platform.

### US-024: Custom Webhook Adapter
Priority: Must Have  
As an Integration Admin, I want to configure a webhook so that any system can receive support tickets.

Acceptance Criteria:
- Admin can configure endpoint URL, headers, auth, field mapping.
- System can test webhook.
- Ticket creation sends normalized payload or mapped payload.
- Failures are logged and queued.

### US-025: Native ServiceNow or Jira Adapter
Priority: Should Have  
As an Integration Admin, I want a native adapter for one popular ticketing system.

Acceptance Criteria:
- Adapter implements common interface.
- Admin can test connection.
- Ticket creation returns external ticket ID.
- Field mapping is configurable.

### US-026: Ticket Creation From Conversation
Priority: Must Have  
As a user, I want a ticket created when the issue is unresolved.

Acceptance Criteria:
- Ticket contains conversation summary.
- Ticket contains troubleshooting steps tried.
- User receives ticket reference.
- Ticket mapping is stored.

### US-027: Retry Failed Ticket Creation
Priority: Should Have  
As an admin, I want failed ticket creation retried.

Acceptance Criteria:
- Failed ticket creation is stored.
- Retry count is tracked.
- Admin can view sync errors.

---

# Epic 8: Feedback and Closure

## Goal
Ensure each support session ends with resolution, ticket, or abandonment status and feedback request.

## User Stories

### US-028: Confirm Resolution
Priority: Must Have  
As a user, I want to confirm whether the issue is resolved.

Acceptance Criteria:
- AI asks if issue is resolved.
- User confirmation is required.
- Session is marked resolved only after confirmation.

### US-029: Collect Feedback
Priority: Must Have  
As a support supervisor, I want feedback after each session.

Acceptance Criteria:
- CSAT rating is captured.
- Optional comment is captured.
- Feedback links to conversation and ticket.
- Negative feedback can be flagged.

### US-030: Session Closure Status
Priority: Must Have  
As the system, I want every session to have a clear final status.

Allowed statuses:
- resolved
- ticket_created
- abandoned
- failed
- escalated_without_ticket

Acceptance Criteria:
- Session status is stored.
- Reports use this status.

---

# Epic 9: Reporting and Analytics

## Goal
Give supervisors insight into agent performance.

## User Stories

### US-031: Performance Dashboard
Priority: Must Have  
As a Support Supervisor, I want to view core metrics.

Acceptance Criteria:
- Dashboard shows total sessions.
- Shows resolution rate.
- Shows escalation rate.
- Shows tickets created.
- Shows average CSAT.
- Shows top categories.

### US-032: Filter Reports
Priority: Should Have  
As a Supervisor, I want to filter reports.

Filters:
- Date range
- Channel
- Language
- Category
- Product
- Resolution status
- Ticket status

Acceptance Criteria:
- Filters change dashboard results.
- Date range is mandatory.

### US-033: Export Reports
Priority: Should Have  
As an Admin, I want to export reports.

Acceptance Criteria:
- CSV export works.
- XLSX or PDF can be added later.
- Export action is audited.

### US-034: Knowledge Gap Report
Priority: Should Have  
As a Knowledge Manager, I want to see missing knowledge areas.

Acceptance Criteria:
- Low-confidence and unresolved sessions create gap candidates.
- Similar gaps are grouped.
- Knowledge Manager can mark reviewed.

---

# Epic 10: Voice Support

## Goal
Support voice input and voice response.

## User Stories

### US-035: Voice Session
Priority: Should Have  
As a voice user, I want to speak my issue.

Acceptance Criteria:
- User can start voice session.
- Speech is transcribed.
- AI response is converted to speech.
- Transcript is stored.

### US-036: Voice Language Handling
Priority: Should Have  
As a user, I want voice support in my language.

Acceptance Criteria:
- MVP voice supports English first.
- Architecture supports Hindi/Hinglish and other languages.
- Low transcription confidence asks user to repeat.

### US-037: Voice Transcript Review
Priority: Could Have  
As a supervisor, I want to review voice transcripts.

Acceptance Criteria:
- Transcript is linked to conversation.
- Audio recording policy is configurable.
- PII masking can be applied later.

---

# Epic 11: Audit and Governance

## Goal
Track sensitive admin and system actions.

## User Stories

### US-038: Audit Admin Actions
Priority: Must Have  
As the system, I want to log admin changes.

Acceptance Criteria:
- Upload, approve, archive, version, integration, user, role, and rule changes are logged.
- Audit record includes actor, action, timestamp, entity, old value, new value.
- Audit logs are read-only.

### US-039: View Audit Logs
Priority: Should Have  
As an Admin, I want to search audit logs.

Acceptance Criteria:
- Logs can be filtered by actor, action, entity, date.
- Only authorized users can view logs.

---

# MVP Scope Summary

## Must Have for MVP

1. Multi-tenant foundation
2. Admin auth and roles
3. Chat support
4. English/Hindi/Hinglish support
5. User and issue capture
6. Issue classification
7. Safety detection
8. Knowledge upload
9. Document approval
10. Document archive
11. Active-only retrieval
12. SOP creation and execution
13. Ticket creation using custom webhook adapter
14. Feedback
15. Basic reporting
16. Audit logs

## Should Have After MVP

1. Native ServiceNow/Jira adapter
2. Voice support
3. Advanced report filters
4. Ticket retry queue
5. Knowledge gap dashboard
6. Export reports

## Could Have Later

1. Full omnichannel support
2. WhatsApp integration
3. Mobile app
4. Advanced workflow builder
5. Auto KB generation from resolved tickets
6. Two-way ticket sync
7. Sentiment analysis
8. Advanced multilingual voice support

## Won't Have Now

1. Full enterprise SSO
2. Complex multi-region deployment
3. Custom ML model training
4. Real-time human agent handoff chat
5. Offline mobile app
