# 05_IMPLEMENTATION_SEQUENCE.md

# Codex Implementation Sequence

## Important Instruction

Do not give Codex the entire product and ask it to build everything at once. Use a staged backlog. Codex works better when each task is narrow, testable, and has clear acceptance criteria.

Use this order.

---

# Stage 0: Context and Repository Setup

## Goal
Prepare Codex with full product context and persistent instructions.

## Files to Add First
1. `AGENTS.md`
2. `docs/00_MASTER_CONTEXT_AND_AGENTS.md`
3. `docs/01_EPICS_USER_STORIES_MOSCOW.md`
4. `docs/02_DATABASE_SCHEMA.md`
5. `docs/03_API_SPECIFICATION.md`
6. `docs/04_MODULE_WISE_CODEX_PROMPTS.md`
7. `docs/05_IMPLEMENTATION_SEQUENCE.md`
8. `docs/06_TESTING_ACCEPTANCE_CRITERIA.md`

## Codex Task
Use Prompt 0: Repository Assessment.

Expected Output:
- Repo assessment
- Recommended build path
- Any setup issues

---

# Stage 1: Scaffold and Foundation

## Task 1
Use Prompt 1: Project Scaffold.

## Task 2
Use Prompt 2: Database and Prisma Schema.

## Task 3
Use Prompt 3: Authentication and RBAC.

## Task 4
Use Prompt 4: Tenant Settings and Business Hours.

Stage 1 Done When:
- App starts.
- Admin can log in.
- Tenant schema exists.
- Tenant settings exist.
- Basic admin pages exist.
- Role protection works.

---

# Stage 2: Chat MVP

## Task 5
Use Prompt 5: Chat Support MVP.

## Task 6
Use Prompt 6: AI Issue Capture and Classification.

Stage 2 Done When:
- User can start chat.
- Conversation and messages are stored.
- User can select English/Hindi/Hinglish.
- System can classify engineering issue.
- Safety risk detection works.

---

# Stage 3: Knowledge Base and RAG

## Task 7
Use Prompt 7: Knowledge Base Upload and Document Lifecycle.

## Task 8
Use Prompt 8: Active-only RAG Retrieval.

Stage 3 Done When:
- Admin can upload document.
- Admin can approve document.
- Admin can archive document.
- Only active documents are retrieved.
- Tests prove archived/draft docs are excluded.

---

# Stage 4: SOP Engine

## Task 9
Use Prompt 9: SOP Builder and SOP Execution.

Stage 4 Done When:
- Admin can create SOP.
- Admin can approve SOP.
- Chat can execute SOP steps.
- Mandatory safety steps are enforced.
- SOP execution is logged.

---

# Stage 5: Ticketing

## Task 10
Use Prompt 10: Ticketing Adapter Layer.

## Task 11
Use Prompt 11: Ticket Creation From Conversation.

Stage 5 Done When:
- Custom webhook adapter works.
- Ticketing integration can be configured.
- Unresolved chat creates ticket.
- Ticket ID is shown to user.
- Sync logs are stored.

---

# Stage 6: Closure and Feedback

## Task 12
Use Prompt 12: Feedback and Session Closure.

Stage 6 Done When:
- User confirms resolution.
- Feedback is collected.
- Conversation final status is stored.
- Negative feedback can be reviewed.

---

# Stage 7: Admin Reporting

## Task 13
Use Prompt 13: Basic Reporting Dashboard.

## Task 14
Use Prompt 14: Conversation Review and Audit Logs.

Stage 7 Done When:
- Supervisor can view metrics.
- Supervisor can review conversations.
- Admin can view audit logs.
- CSV report export works.

---

# Stage 8: Voice and Multilingual Expansion

## Task 15
Use Prompt 15: Voice Support Foundation.

## Task 16
Use Prompt 16: Multilingual Expansion.

Stage 8 Done When:
- Voice module structure exists.
- Voice transcripts can be stored.
- Language service supports expansion.

---

# Stage 9: Knowledge Improvement Loop

## Task 17
Use Prompt 17: Knowledge Gap Detection.

Stage 9 Done When:
- Knowledge gaps are created from failed sessions.
- Admin can view and review gaps.

---

# Stage 10: MVP Hardening and Demo

## Task 18
Use Prompt 18: End-to-End MVP Hardening.

## Task 19
Use Prompt 19: Demo Data and Demo Script.

Stage 10 Done When:
- MVP flows work end to end.
- Tests pass.
- Demo data exists.
- Demo proves archived documents are not used.
- MVP readiness report is available.

---

# Suggested First Native Integration After MVP

Use Prompt 20: Native Ticketing Adapter Example.

Recommended first native adapter:
1. ServiceNow if targeting enterprise clients.
2. Jira Service Management if targeting software/IT-heavy support teams.
3. Zendesk/Freshservice if targeting SMB service teams.
4. BMC Helix/Remedy if targeting large legacy enterprise environments.

---

# Development Rules for Every Stage

For every Codex task, instruct it to:

1. Inspect existing files first.
2. Reuse project conventions.
3. Make small modular changes.
4. Add or update tests.
5. Run available validation commands.
6. Summarize:
   - Files changed
   - What was implemented
   - Tests run
   - Known gaps
   - Next recommended task

---

# What Not to Do

Do not ask Codex:
- “Build the whole app.”
- “Create all modules end to end in one step.”
- “Implement full voice, all languages, all ticketing platforms in MVP.”
- “Skip tests.”
- “Use archived docs for fallback.”
- “Generate unsafe troubleshooting from general model knowledge.”

---

# Recommended MVP Build Order for Fastest Demo

If the goal is a fast working demo, use this compressed order:

1. Scaffold
2. Database
3. Auth
4. Chat
5. Document upload/approve/archive
6. Active-only retrieval
7. Basic SOP execution
8. Custom webhook ticketing
9. Feedback
10. Dashboard
11. Demo seed data

This demo will clearly show the business value:
- After-hours AI support
- Engineering issue capture
- SOP-based troubleshooting
- Safe escalation
- Ticket creation
- Feedback
- Performance reporting
