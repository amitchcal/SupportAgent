# 06_TESTING_ACCEPTANCE_CRITERIA.md

# Testing and Acceptance Criteria

## Testing Philosophy

The most important tests are not visual tests. The most important tests are business-rule tests:

1. Tenant isolation
2. Active-only document retrieval
3. Archived document exclusion
4. Safety escalation
5. Low-confidence fallback
6. Ticket creation through adapter
7. Feedback collection
8. Admin audit logging

---

# Test Categories

## 1. Unit Tests

Use for:
- Issue classification
- Safety detection
- Language detection abstraction
- Ticket payload mapping
- SOP branching
- Active document filtering
- Tenant access helper
- Report metric calculation

## 2. API Tests

Use for:
- Auth APIs
- Conversation APIs
- Document lifecycle APIs
- SOP APIs
- Ticketing APIs
- Feedback APIs
- Reports APIs

## 3. Integration Tests

Use for:
- Chat to ticket creation
- Document approval to retrieval
- SOP execution to resolution
- Low confidence to knowledge gap
- Ticket adapter test using mocked external systems

## 4. End-to-End Tests

Use for:
- User starts chat
- User reports issue
- AI asks safety question
- AI retrieves active KB
- AI executes SOP
- User confirms unresolved
- Ticket is created
- Feedback is collected
- Report metrics update

---

# Critical Test Cases

## TC-001: Tenant Isolation

Steps:
1. Create tenant A and tenant B.
2. Add document to tenant A.
3. Login as tenant B.
4. Try to retrieve tenant A document.

Expected:
- Tenant B cannot access tenant A document.
- API returns forbidden or empty results.

---

## TC-002: Archived Document Is Not Retrieved

Steps:
1. Upload document.
2. Approve document.
3. Confirm retrieval works.
4. Archive document.
5. Search same query again.

Expected:
- Document is not retrieved after archive.
- Retrieval service filters it out.
- Audit log records archive action.

---

## TC-003: Draft Document Is Not Retrieved

Steps:
1. Upload document but do not approve.
2. Search for content from that document.

Expected:
- No live support retrieval result from draft document.

---

## TC-004: Active Document Is Retrieved

Steps:
1. Upload and approve document.
2. Search using relevant issue query.

Expected:
- Active document chunks are returned.
- Result includes document metadata.

---

## TC-005: Safety Risk Escalation

Input:
"Machine is smoking and there is burning smell near the motor."

Expected:
- safetyRisk = true.
- nextAction = emergency_escalation.
- No troubleshooting steps are given.
- Critical ticket path is triggered.

---

## TC-006: Low Confidence Fallback

Input:
Unclear issue with no matching category and no matching KB.

Expected:
- System asks clarification.
- If still low confidence, creates escalation.
- Knowledge gap is created.

---

## TC-007: SOP Execution

Steps:
1. Create active SOP with 3 steps.
2. Start conversation.
3. Trigger SOP.
4. Respond to each step.

Expected:
- Steps are executed in order.
- Step logs are stored.
- Final state is resolved or escalated.

---

## TC-008: Mandatory Safety Step Cannot Be Skipped

Steps:
1. Create SOP with mandatory safety step.
2. Try to jump to later step.

Expected:
- System blocks skip.
- User must answer safety step first.

---

## TC-009: Ticket Creation Through Custom Webhook

Steps:
1. Configure custom webhook integration.
2. Start unresolved conversation.
3. Create ticket.

Expected:
- Normalized payload is generated.
- Webhook adapter is called.
- Ticket record stores external reference.
- Sync log is created.

---

## TC-010: Ticket Creation Failure

Steps:
1. Configure failing webhook.
2. Try to create ticket.

Expected:
- Ticket creation failure is stored.
- Sync log includes error.
- User receives safe fallback message.
- Retry can be attempted later if retry module exists.

---

## TC-011: Feedback Collection

Steps:
1. Complete resolved or ticket-created session.
2. Submit feedback.

Expected:
- Feedback is stored.
- Feedback links to conversation.
- Report metrics update.

---

## TC-012: Admin Audit Log

Admin actions:
- Upload document
- Approve document
- Archive document
- Create SOP
- Approve SOP
- Configure ticket integration
- Export report

Expected:
- Each action creates audit log.
- Audit log includes actor, entity, timestamp, old/new values where applicable.

---

# MVP Acceptance Checklist

## User Support

- [ ] User can start chat.
- [ ] User can select language.
- [ ] User can provide details.
- [ ] User can describe engineering issue.
- [ ] System stores messages.
- [ ] System classifies issue.
- [ ] System detects safety risk.
- [ ] System asks clarifying questions.
- [ ] System confirms issue summary.

## Knowledge Base

- [ ] Admin can upload document.
- [ ] Admin can approve document.
- [ ] Admin can archive document.
- [ ] Admin can upload new version.
- [ ] Draft documents are not retrieved.
- [ ] Archived documents are not retrieved.
- [ ] Active documents are retrieved.
- [ ] Retrieval is tenant-scoped.

## SOP

- [ ] Admin can create SOP.
- [ ] Admin can approve SOP.
- [ ] Active SOP can be executed.
- [ ] Draft SOP cannot be executed.
- [ ] Safety step cannot be skipped.
- [ ] SOP execution is logged.

## Ticketing

- [ ] Admin can configure custom webhook.
- [ ] Admin can test webhook.
- [ ] Unresolved issue creates ticket.
- [ ] Ticket includes conversation summary.
- [ ] Ticket includes troubleshooting history.
- [ ] Ticket external ID is shown.
- [ ] Ticket failure is logged.

## Feedback

- [ ] User is asked for feedback.
- [ ] Feedback is stored.
- [ ] Negative feedback is visible to supervisor.

## Reports

- [ ] Dashboard shows total sessions.
- [ ] Dashboard shows resolution rate.
- [ ] Dashboard shows escalation rate.
- [ ] Dashboard shows average CSAT.
- [ ] Dashboard shows top categories.
- [ ] CSV export works.

## Security and Governance

- [ ] Admin login works.
- [ ] Role-based access works.
- [ ] Tenant isolation works.
- [ ] Admin actions are audited.
- [ ] Secrets are not exposed.
- [ ] Archived documents are never used in live AI support.

---

# Manual Demo Acceptance Script

Use this script for stakeholder demo.

## Setup

1. Login as Tenant Admin.
2. Upload "Compressor E-45 Troubleshooting Guide v1".
3. Approve the document.
4. Upload "Old Compressor E-45 Guide".
5. Archive old guide.
6. Create and approve SOP "Compressor Overheating L0 SOP".
7. Configure custom webhook ticketing integration.

## Demo Flow

1. Open chat as user.
2. Select English.
3. Enter:
   "Compressor line 2 is overheating and showing E-45 alarm."
4. AI should ask safety question.
5. Reply:
   "No smoke, no leakage, no burning smell."
6. AI should ask clarifying questions.
7. AI should execute SOP steps.
8. Reply that issue is still not resolved.
9. AI should create ticket.
10. AI should show ticket reference.
11. AI should ask feedback.
12. Submit rating.
13. Login as supervisor.
14. View conversation.
15. View dashboard metrics.
16. Confirm archived guide was not used.

Demo success:
- Support flow works.
- Ticket is created.
- Feedback is captured.
- Report is updated.
- Archived document is not used.
