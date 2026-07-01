# 03_API_SPECIFICATION.md

# Generic AI L0 Support Agent — API Specification

Use REST APIs for MVP. Keep the API modular and tenant-scoped.

## API Design Rules

1. All admin APIs require authentication.
2. All tenant-specific APIs require tenant context.
3. Never accept tenantId blindly from client if it can be derived from session/domain.
4. Validate all inputs.
5. Return structured error objects.
6. Log sensitive admin actions.
7. Ticketing integrations must use adapter service internally.
8. AI chat APIs must enforce active-document-only retrieval.

---

# Standard Response Format

## Success

```json
{
  "success": true,
  "data": {}
}
```

## Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error",
    "details": {}
  }
}
```

---

# Auth APIs

## POST /api/auth/login

Request:

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Admin",
      "email": "admin@example.com",
      "role": "tenant_admin",
      "tenantId": "uuid"
    }
  }
}
```

## POST /api/auth/logout

Response:

```json
{
  "success": true
}
```

## GET /api/auth/me

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Admin",
    "email": "admin@example.com",
    "role": "tenant_admin",
    "tenantId": "uuid"
  }
}
```

---

# Tenant APIs

## GET /api/admin/tenant/settings

Response:

```json
{
  "success": true,
  "data": {
    "supportMode": "after_hours",
    "enabledLanguages": ["en", "hi", "hinglish"],
    "requiredUserFields": ["name", "email", "company", "site"],
    "aiConfidenceThreshold": 0.7,
    "allowAnonymousChat": true
  }
}
```

## PATCH /api/admin/tenant/settings

Request:

```json
{
  "supportMode": "after_hours",
  "enabledLanguages": ["en", "hi", "hinglish"],
  "requiredUserFields": ["name", "email", "company", "site"],
  "aiConfidenceThreshold": 0.75,
  "allowAnonymousChat": true
}
```

Rules:
- Audit this change.
- Validate language codes.
- Validate confidence threshold between 0 and 1.

---

# Chat APIs

## POST /api/support/conversations

Creates a support conversation.

Request:

```json
{
  "tenantSlug": "demo-engineering",
  "channel": "chat",
  "language": "en",
  "user": {
    "name": "Amit",
    "email": "amit@example.com",
    "phone": "9999999999",
    "company": "ABC Engineering",
    "site": "Plant 1"
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "conversationId": "uuid",
    "status": "open",
    "language": "en"
  }
}
```

## POST /api/support/conversations/{conversationId}/messages

Sends user message and receives AI reply.

Request:

```json
{
  "message": "Compressor line 2 is overheating and showing E-45 alarm.",
  "language": "en"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "conversationId": "uuid",
    "agentMessage": "I understand the compressor is overheating and showing E-45. Before troubleshooting, is there any smoke, burning smell, leakage, or abnormal vibration?",
    "status": "open",
    "detectedIssue": {
      "summary": "Compressor overheating with E-45 alarm",
      "category": "Mechanical",
      "severity": "high",
      "safetyRisk": false
    },
    "nextAction": "ask_clarification"
  }
}
```

Allowed nextAction values:
- ask_clarification
- execute_sop_step
- provide_answer
- confirm_resolution
- create_ticket
- emergency_escalation
- request_feedback

## GET /api/support/conversations/{conversationId}

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "open",
    "language": "en",
    "messages": []
  }
}
```

## POST /api/support/conversations/{conversationId}/resolve

Request:

```json
{
  "resolved": true,
  "resolutionSummary": "User confirmed issue resolved after clearing ventilation obstruction as per SOP."
}
```

Response:

```json
{
  "success": true,
  "data": {
    "status": "resolved",
    "nextAction": "request_feedback"
  }
}
```

## POST /api/support/conversations/{conversationId}/abandon

Marks session abandoned.

Request:

```json
{
  "reason": "User closed chat window"
}
```

---

# Feedback APIs

## POST /api/support/conversations/{conversationId}/feedback

Request:

```json
{
  "ratingType": "csat_1_5",
  "ratingValue": 5,
  "wasResolved": true,
  "comment": "Very helpful"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "feedbackId": "uuid"
  }
}
```

---

# Knowledge Base APIs

## POST /api/admin/documents

Uploads document metadata and file.

Content-Type: multipart/form-data

Fields:
- title
- description
- category
- productId
- language
- versionNumber
- tags
- file

Response:

```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "versionId": "uuid",
    "status": "pending_approval",
    "indexingStatus": "queued"
  }
}
```

Rules:
- Store file.
- Extract text.
- Create chunks.
- Do not make searchable until approved.
- Audit upload.

## GET /api/admin/documents

Query params:
- status
- category
- language
- productId
- search

Response:

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0
  }
}
```

## GET /api/admin/documents/{documentId}

Response includes metadata, versions, status, and chunks preview.

## POST /api/admin/documents/{documentId}/approve

Request:

```json
{
  "versionId": "uuid"
}
```

Rules:
- Set document status active.
- Set selected version active.
- Set chunks active.
- Optionally archive previous version.
- Audit approval.

## POST /api/admin/documents/{documentId}/archive

Request:

```json
{
  "reason": "Superseded by version 2.0"
}
```

Rules:
- Reason is mandatory.
- Set document, current version, and chunks to archived.
- Exclude from live retrieval.
- Audit archive.

## POST /api/admin/documents/{documentId}/versions

Upload new document version.

Request:
- multipart/form-data with file and versionNumber.

Rules:
- New version starts pending_approval.
- Old active version remains active until new version is approved.

---

# SOP APIs

## POST /api/admin/sops

Request:

```json
{
  "title": "Compressor overheating basic L0 SOP",
  "description": "Safe L0 troubleshooting for compressor overheating.",
  "category": "Mechanical",
  "productId": "uuid",
  "language": "en",
  "triggerKeywords": ["compressor", "overheating", "temperature", "E-45"],
  "steps": [
    {
      "stepOrder": 1,
      "stepType": "safety_warning",
      "instruction": "Before proceeding, confirm there is no smoke, burning smell, leakage, or abnormal vibration.",
      "expectedResponseType": "yes_no",
      "isMandatory": true,
      "isSafetyStep": true
    },
    {
      "stepOrder": 2,
      "stepType": "ask_question",
      "instruction": "Is the compressor currently running?",
      "expectedResponseType": "yes_no",
      "isMandatory": true
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "data": {
    "sopId": "uuid",
    "status": "draft"
  }
}
```

## POST /api/admin/sops/{sopId}/approve

Response:
```json
{
  "success": true,
  "data": {
    "status": "active"
  }
}
```

## POST /api/admin/sops/{sopId}/archive

Request:
```json
{
  "reason": "Superseded by new SOP"
}
```

## POST /api/support/conversations/{conversationId}/sop/{sopId}/step

Executes or records a SOP step response.

Request:

```json
{
  "stepId": "uuid",
  "userResponse": "No smoke or leakage"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "nextStep": {},
    "status": "continue"
  }
}
```

---

# Ticketing APIs

## GET /api/admin/integrations/ticketing

Returns configured integrations.

## POST /api/admin/integrations/ticketing

Request:

```json
{
  "type": "custom_webhook",
  "name": "Demo Webhook",
  "baseUrl": "https://example.com/support-ticket",
  "authType": "api_key",
  "headers": {
    "x-api-key": "encrypted-or-secret-ref"
  },
  "fieldMapping": {
    "summary": "issue.summary",
    "description": "issue.description",
    "severity": "issue.severity"
  },
  "isActive": false
}
```

Rules:
- Encrypt credentials/secrets.
- Audit creation.

## POST /api/admin/integrations/ticketing/{integrationId}/test

Response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "message": "Connection successful"
  }
}
```

## POST /api/support/conversations/{conversationId}/ticket

Creates ticket from conversation.

Request:

```json
{
  "preferredCallbackTime": "2026-07-01T10:00:00+05:30",
  "additionalNotes": "User wants callback tomorrow morning."
}
```

Response:

```json
{
  "success": true,
  "data": {
    "ticketId": "uuid",
    "externalTicketId": "INC0012345",
    "externalTicketUrl": "https://ticketing.example.com/INC0012345",
    "status": "created"
  }
}
```

Failure Response:

```json
{
  "success": false,
  "error": {
    "code": "TICKET_CREATION_FAILED",
    "message": "Ticket creation failed and has been queued for retry.",
    "details": {
      "ticketId": "uuid"
    }
  }
}
```

---

# Reports APIs

## GET /api/admin/reports/performance

Query params:
- dateFrom
- dateTo
- channel
- language
- category
- status

Response:

```json
{
  "success": true,
  "data": {
    "totalSessions": 100,
    "resolvedSessions": 60,
    "ticketCreatedSessions": 30,
    "abandonedSessions": 10,
    "resolutionRate": 0.6,
    "escalationRate": 0.3,
    "averageCsat": 4.2,
    "topCategories": [
      {
        "category": "Mechanical",
        "count": 35
      }
    ],
    "languageUsage": [
      {
        "language": "en",
        "count": 70
      }
    ]
  }
}
```

## GET /api/admin/reports/knowledge-gaps

Response:
```json
{
  "success": true,
  "data": {
    "items": []
  }
}
```

## GET /api/admin/reports/export

Query params:
- reportType
- dateFrom
- dateTo
- format=csv

Rules:
- Audit export.
- Return downloadable file.

---

# Audit APIs

## GET /api/admin/audit-logs

Query params:
- actorUserId
- action
- entityType
- dateFrom
- dateTo

Response:
```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0
  }
}
```

---

# AI Service Internal Interfaces

These do not need to be public APIs initially, but should exist as clean service interfaces.

## AIConversationService

```ts
interface AIConversationService {
  processUserMessage(input: ProcessMessageInput): Promise<ProcessMessageResult>;
}
```

## KnowledgeRetrievalService

```ts
interface KnowledgeRetrievalService {
  searchActiveKnowledge(input: {
    tenantId: string;
    query: string;
    language?: string;
    category?: string;
    productId?: string;
    limit?: number;
  }): Promise<RetrievedKnowledgeChunk[]>;
}
```

Mandatory implementation rule:
- `searchActiveKnowledge` must always filter active approved content only.

## TicketingAdapter

```ts
interface TicketingAdapter {
  testConnection(): Promise<ConnectionTestResult>;
  createTicket(payload: NormalizedTicketPayload): Promise<TicketCreationResult>;
  getTicketStatus?(externalTicketId: string): Promise<TicketStatusResult>;
  addComment?(externalTicketId: string, comment: string): Promise<void>;
  attachFiles?(externalTicketId: string, files: Attachment[]): Promise<void>;
}
```

---

# Security Requirements

1. Admin APIs require authenticated admin role.
2. End-user support APIs must validate tenant slug or tenant token.
3. File uploads must validate type and size.
4. Credentials must be encrypted.
5. Secrets must not be returned by APIs.
6. Tenant isolation must be tested.
7. Conversation transcript access must be role-protected.
8. Audit logs must be read-only.
9. Ticket webhook endpoints must not expose secrets in logs.
10. AI prompts must not reveal hidden system instructions or credentials.
