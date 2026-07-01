# 02_DATABASE_SCHEMA.md

# Generic AI L0 Support Agent — Database Schema

Use PostgreSQL. Use Prisma ORM if the project uses TypeScript/Node. The schema below is conceptual and can be converted into `prisma/schema.prisma`.

## Database Design Rules

1. Every tenant-owned table must include `tenant_id`.
2. Every query must be tenant-scoped.
3. Use UUID primary keys.
4. Use created_at and updated_at on all important tables.
5. Use soft deletion where audit/history matters.
6. Documents must support status and versioning.
7. Archived documents must remain in the database but must not be retrievable by live AI support.
8. Conversation and ticket records must be immutable enough for audit.
9. Admin actions must be stored in audit_logs.
10. AI retrieval must filter by tenant_id and active/approved status.

---

# Enum Suggestions

```sql
CREATE TYPE tenant_status AS ENUM ('active', 'inactive', 'suspended');

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'tenant_admin',
  'knowledge_manager',
  'support_supervisor',
  'integration_admin',
  'viewer',
  'api_user'
);

CREATE TYPE document_status AS ENUM (
  'draft',
  'pending_approval',
  'active',
  'archived',
  'rejected'
);

CREATE TYPE sop_status AS ENUM (
  'draft',
  'pending_approval',
  'active',
  'archived',
  'rejected'
);

CREATE TYPE conversation_channel AS ENUM ('chat', 'voice');

CREATE TYPE conversation_status AS ENUM (
  'open',
  'resolved',
  'ticket_created',
  'abandoned',
  'failed',
  'escalated_without_ticket'
);

CREATE TYPE message_sender AS ENUM ('user', 'agent', 'system', 'admin');

CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE ticket_status AS ENUM (
  'draft',
  'pending_creation',
  'created',
  'creation_failed',
  'closed',
  'cancelled'
);

CREATE TYPE integration_type AS ENUM (
  'custom_webhook',
  'servicenow',
  'bmc_helix',
  'jira_service_management',
  'zendesk',
  'freshservice',
  'email'
);

CREATE TYPE feedback_rating_type AS ENUM ('csat_1_5', 'thumbs');
```

---

# Core Tables

## tenants

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status tenant_status NOT NULL DEFAULT 'active',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  default_language TEXT NOT NULL DEFAULT 'en',
  logo_url TEXT,
  brand_color TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,
  role user_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);
```

## tenant_settings

```sql
CREATE TABLE tenant_settings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  support_mode TEXT NOT NULL DEFAULT 'after_hours',
  enabled_languages JSONB NOT NULL DEFAULT '["en", "hi", "hinglish"]',
  required_user_fields JSONB NOT NULL DEFAULT '["name", "email", "company", "site"]',
  ai_confidence_threshold NUMERIC(5,2) NOT NULL DEFAULT 0.70,
  allow_anonymous_chat BOOLEAN NOT NULL DEFAULT TRUE,
  auto_create_ticket_on_low_confidence BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);
```

## business_hours

```sql
CREATE TABLE business_hours (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  day_of_week INTEGER NOT NULL,
  start_time TIME,
  end_time TIME,
  is_working_day BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## holidays

```sql
CREATE TABLE holidays (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, holiday_date)
);
```

---

# Industry and Product Tables

## industries

```sql
CREATE TABLE industries (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## products

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  industry_id UUID REFERENCES industries(id),
  name TEXT NOT NULL,
  model TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## assets

```sql
CREATE TABLE assets (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  product_id UUID REFERENCES products(id),
  asset_code TEXT,
  serial_number TEXT,
  site TEXT,
  location TEXT,
  installed_at DATE,
  warranty_end_date DATE,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

# Knowledge Base Tables

## documents

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  industry_id UUID REFERENCES industries(id),
  title TEXT NOT NULL,
  description TEXT,
  product_id UUID REFERENCES products(id),
  category TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  current_version_id UUID,
  status document_status NOT NULL DEFAULT 'draft',
  tags JSONB NOT NULL DEFAULT '[]',
  effective_date DATE,
  expiry_date DATE,
  uploaded_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  archived_by UUID REFERENCES users(id),
  archived_at TIMESTAMP,
  archive_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## document_versions

```sql
CREATE TABLE document_versions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  document_id UUID NOT NULL REFERENCES documents(id),
  version_number TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_mime_type TEXT,
  file_size_bytes BIGINT,
  extracted_text TEXT,
  status document_status NOT NULL DEFAULT 'draft',
  uploaded_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_number)
);
```

## document_chunks

```sql
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  document_id UUID NOT NULL REFERENCES documents(id),
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR,
  status document_status NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Important retrieval query rule:

```sql
SELECT *
FROM document_chunks dc
JOIN documents d ON d.id = dc.document_id
JOIN document_versions dv ON dv.id = dc.document_version_id
WHERE dc.tenant_id = :tenant_id
  AND d.status = 'active'
  AND dv.status = 'active'
  AND dc.status = 'active';
```

---

# SOP Tables

## sop_definitions

```sql
CREATE TABLE sop_definitions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  industry_id UUID REFERENCES industries(id),
  product_id UUID REFERENCES products(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  version_number TEXT NOT NULL DEFAULT '1.0',
  status sop_status NOT NULL DEFAULT 'draft',
  trigger_keywords JSONB NOT NULL DEFAULT '[]',
  safety_level TEXT DEFAULT 'normal',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  archived_by UUID REFERENCES users(id),
  archived_at TIMESTAMP,
  archive_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## sop_steps

```sql
CREATE TABLE sop_steps (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  sop_id UUID NOT NULL REFERENCES sop_definitions(id),
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  title TEXT,
  instruction TEXT NOT NULL,
  expected_response_type TEXT,
  options JSONB,
  branch_rules JSONB,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  is_safety_step BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_condition JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (sop_id, step_order)
);
```

## sop_execution_logs

```sql
CREATE TABLE sop_execution_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID NOT NULL,
  sop_id UUID NOT NULL REFERENCES sop_definitions(id),
  step_id UUID REFERENCES sop_steps(id),
  user_response TEXT,
  result TEXT,
  executed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

# Conversation Tables

## conversations

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  channel conversation_channel NOT NULL DEFAULT 'chat',
  status conversation_status NOT NULL DEFAULT 'open',
  language TEXT NOT NULL DEFAULT 'en',
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  user_company TEXT,
  user_site TEXT,
  asset_id UUID REFERENCES assets(id),
  product_id UUID REFERENCES products(id),
  issue_summary TEXT,
  issue_category TEXT,
  issue_subcategory TEXT,
  severity severity_level,
  urgency severity_level,
  safety_risk BOOLEAN NOT NULL DEFAULT FALSE,
  ai_confidence NUMERIC(5,2),
  resolution_summary TEXT,
  escalation_reason TEXT,
  ticket_id UUID,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## conversation_messages

```sql
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  sender message_sender NOT NULL,
  original_language TEXT,
  normalized_language TEXT,
  content TEXT NOT NULL,
  translated_content TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## attachments

```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID REFERENCES conversations(id),
  ticket_id UUID,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by_user BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## voice_transcripts

```sql
CREATE TABLE voice_transcripts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  transcript_text TEXT NOT NULL,
  audio_url TEXT,
  language TEXT,
  confidence NUMERIC(5,2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

# Ticketing Tables

## ticketing_integrations

```sql
CREATE TABLE ticketing_integrations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  type integration_type NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT,
  auth_type TEXT,
  auth_config_encrypted TEXT,
  headers JSONB,
  field_mapping JSONB,
  default_project_or_table TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  last_tested_at TIMESTAMP,
  last_test_status TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## tickets

```sql
CREATE TABLE tickets (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID REFERENCES conversations(id),
  integration_id UUID REFERENCES ticketing_integrations(id),
  status ticket_status NOT NULL DEFAULT 'draft',
  external_ticket_id TEXT,
  external_ticket_url TEXT,
  normalized_payload JSONB NOT NULL,
  ticket_summary TEXT,
  ticket_description TEXT,
  severity severity_level,
  urgency severity_level,
  creation_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## ticket_sync_logs

```sql
CREATE TABLE ticket_sync_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ticket_id UUID REFERENCES tickets(id),
  integration_id UUID REFERENCES ticketing_integrations(id),
  action TEXT NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

# Feedback and Reporting Tables

## feedback

```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  ticket_id UUID REFERENCES tickets(id),
  rating_type feedback_rating_type NOT NULL DEFAULT 'csat_1_5',
  rating_value INTEGER,
  was_resolved BOOLEAN,
  comment TEXT,
  language_quality_rating INTEGER,
  voice_quality_rating INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## knowledge_gaps

```sql
CREATE TABLE knowledge_gaps (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID REFERENCES conversations(id),
  issue_summary TEXT NOT NULL,
  issue_category TEXT,
  reason TEXT NOT NULL,
  frequency_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## report_snapshots

```sql
CREATE TABLE report_snapshots (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  report_type TEXT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  filters JSONB,
  metrics JSONB NOT NULL,
  generated_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

# Audit Table

## audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

# Important Indexes

```sql
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_documents_tenant_status ON documents(tenant_id, status);
CREATE INDEX idx_document_versions_tenant_status ON document_versions(tenant_id, status);
CREATE INDEX idx_document_chunks_tenant_status ON document_chunks(tenant_id, status);
CREATE INDEX idx_sop_tenant_status ON sop_definitions(tenant_id, status);
CREATE INDEX idx_conversations_tenant_status ON conversations(tenant_id, status);
CREATE INDEX idx_conversations_tenant_started ON conversations(tenant_id, started_at);
CREATE INDEX idx_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX idx_tickets_tenant_status ON tickets(tenant_id, status);
CREATE INDEX idx_feedback_tenant_created ON feedback(tenant_id, created_at);
CREATE INDEX idx_audit_tenant_created ON audit_logs(tenant_id, created_at);
```

---

# Seed Data Required for MVP

1. Super Admin user
2. Demo tenant
3. Engineering industry template
4. Default tenant settings
5. Business hours
6. Default issue categories
7. Demo SOP
8. Demo active KB document
9. Custom webhook integration placeholder
10. Default escalation rules

---

# Prisma Implementation Notes

If using Prisma:
- Convert enums to Prisma enums.
- Use `String @id @default(uuid())`.
- Use `Json` for JSONB fields.
- For vector embeddings, use raw SQL migration if Prisma does not fully support vector type.
- Keep vector search in a repository/service layer.
- Add middleware or helper function to enforce tenant scoping.
