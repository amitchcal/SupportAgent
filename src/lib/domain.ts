export const roles = [
  "SUPER_ADMIN",
  "TENANT_ADMIN",
  "KNOWLEDGE_MANAGER",
  "INTEGRATION_ADMIN",
  "SUPPORT_SUPERVISOR",
  "VIEWER",
] as const;

export type Role = (typeof roles)[number];
export type TenantStatus = "ACTIVE" | "INACTIVE";
export type ThemeMode = "light" | "dark" | "system";
export type BorderRadius = "none" | "small" | "medium" | "large" | "rounded";

export type TenantBranding = {
  productDisplayName: string;
  companyDisplayName: string;
  supportAgentName: string;
  logoUrl: string;
  faviconUrl: string;
  footerText: string;
  supportEmail: string;
  supportPhone: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  hidePlatformBranding: boolean;
};

export type TenantTheme = {
  mode: ThemeMode;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  radius: BorderRadius;
  fontFamily: "Inter" | "Arial" | "Georgia" | "system-ui";
};

export type TenantSettings = {
  timezone: string;
  defaultLanguage: "en" | "hi" | "hinglish";
  enabledLanguages: Array<"en" | "hi" | "hinglish">;
  businessHours: Record<string, { open: string; close: string; closed?: boolean }>;
  requiredSupportFields: string[];
  escalationBehavior: "always" | "outside-hours" | "safety-and-low-confidence";
  confidenceThreshold: number;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  settings: TenantSettings;
  branding: TenantBranding;
  theme: TenantTheme;
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  tenantId: string | null;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
};

export type SupportedLanguage = "en" | "hi" | "hinglish";
export type IssueCategory = "Mechanical" | "Electrical" | "Instrumentation" | "PLC/Automation" | "Hydraulic" | "Pneumatic" | "Calibration" | "Installation" | "Warranty" | "Spare Parts" | "Documentation" | "Preventive Maintenance" | "Safety" | "Other";
export type Classification = { category: IssueCategory; severity: "low" | "medium" | "high" | "critical"; urgency: "routine" | "soon" | "urgent" | "immediate"; confidence: number };
export type IssueDetails = { summary: string; asset: string; model: string; serialNumber: string; errorCode: string; site: string; severityClues: string[]; missingQuestions: string[] };
export type ConversationStatus = "AWAITING_CLARIFICATION" | "AWAITING_CONFIRMATION" | "SOP_IN_PROGRESS" | "RESOLVED" | "ESCALATED" | "TICKET_CREATED";
export type Conversation = { id: string; tenantId: string; language: SupportedLanguage; contact: Record<string, string>; issue: IssueDetails; classification: Classification; safetyReasons: string[]; lowConfidenceReason: string | null; clarificationCount: number; status: ConversationStatus; createdAt: string; updatedAt: string };
export type ConversationMessage = { id: string; tenantId: string; conversationId: string; role: "USER" | "ASSISTANT" | "SYSTEM"; content: string; createdAt: string };
export type KnowledgeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED" | "REJECTED";
export type KnowledgeDocument = { id: string; tenantId: string; title: string; description: string; tags: string[]; status: KnowledgeStatus; currentVersionId: string | null; createdBy: string; createdAt: string; updatedAt: string };
export type KnowledgeVersion = { id: string; tenantId: string; documentId: string; version: number; fileName: string; fileType: "pdf" | "docx" | "txt" | "md" | "html"; storagePath: string; checksum: string; status: KnowledgeStatus; chunks: string[]; createdBy: string; approvedBy: string | null; createdAt: string; approvedAt: string | null };
export const sopStepTypes = ["ask_question", "instruction", "confirmation", "measurement", "upload_request", "branch", "safety_warning", "escalate", "resolve"] as const;
export type SopStepType = (typeof sopStepTypes)[number];
export type SopStep = { id: string; order: number; type: SopStepType; content: string; responseFormat: "text" | "boolean" | "number" | "file" | "choice"; mandatory: boolean; branches?: Array<{ equals: string; nextStepId: string }> };
export type SopDefinition = { id: string; tenantId: string; title: string; category: IssueCategory; product: string; language: SupportedLanguage; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; version: number; steps: SopStep[]; createdBy: string; approvedBy: string | null; createdAt: string; updatedAt: string; approvedAt: string | null };
export type SopExecutionLog = { stepId: string | null; event: "STARTED" | "STEP_CONFIRMED" | "SAFETY_BLOCKED" | "ESCALATED" | "RESOLVED"; response: string; createdAt: string };
export type SopExecution = { id: string; tenantId: string; conversationId: string; sopId: string; currentStepId: string | null; status: "IN_PROGRESS" | "RESOLVED" | "ESCALATED"; completedStepIds: string[]; logs: SopExecutionLog[]; createdAt: string; updatedAt: string };
export type TicketAttachment = { name: string; url: string; contentType: string };
export type NormalizedTicketPayload = { schemaVersion: "1.0"; tenantId: string; conversationId: string; requester: Record<string, string>; asset: { id: string; model: string; serialNumber: string; site: string }; issue: { summary: string; category: IssueCategory; severity: Classification["severity"]; urgency: Classification["urgency"]; errorCode: string; safetyReasons: string[] }; troubleshooting: Array<{ step: string; response: string; outcome: string; timestamp: string }>; attachments: TicketAttachment[]; transcript: Array<{ role: ConversationMessage["role"]; content: string; timestamp: string }> };
export type TicketingIntegration = { id: string; tenantId: string; type: "CUSTOM_WEBHOOK"; name: string; endpointUrl: string; headers: Record<string, string>; authType: "NONE" | "BEARER" | "BASIC"; authConfigEncrypted: string; fieldMapping: Record<string, string>; isActive: boolean; lastTestedAt: string | null; lastTestStatus: "SUCCESS" | "FAILED" | null; createdBy: string; createdAt: string; updatedAt: string };
export type Ticket = { id: string; reference: string; tenantId: string; conversationId: string; integrationId: string | null; status: "PENDING_CREATION" | "CREATED" | "CREATION_FAILED"; externalTicketId: string | null; externalTicketUrl: string | null; normalizedPayload: NormalizedTicketPayload; creationAttempts: number; lastError: string | null; createdAt: string; updatedAt: string };
export type TicketSyncLog = { id: string; tenantId: string; ticketId: string | null; integrationId: string | null; action: "TEST" | "CREATE"; requestPayload: unknown; responsePayload: unknown; status: "SUCCESS" | "FAILED"; errorMessage: string | null; createdAt: string };

export type Database = { tenants: Tenant[]; users: User[]; auditLogs: AuditLog[]; conversations: Conversation[]; conversationMessages: ConversationMessage[]; knowledgeDocuments: KnowledgeDocument[]; knowledgeVersions: KnowledgeVersion[]; sopDefinitions: SopDefinition[]; sopExecutions: SopExecution[]; ticketingIntegrations: TicketingIntegration[]; tickets: Ticket[]; ticketSyncLogs: TicketSyncLog[] };

export const defaultTheme: TenantTheme = {
  mode: "light",
  primary: "#1D4ED8",
  secondary: "#0F172A",
  accent: "#F59E0B",
  background: "#F4F7FB",
  surface: "#FFFFFF",
  text: "#111827",
  mutedText: "#64748B",
  border: "#DDE3EC",
  radius: "medium",
  fontFamily: "Inter",
};

export const defaultBranding: TenantBranding = {
  productDisplayName: "ResolveOps",
  companyDisplayName: "Acme Industrial",
  supportAgentName: "Asha",
  logoUrl: "",
  faviconUrl: "",
  footerText: "Industrial support, available around the clock.",
  supportEmail: "support@example.com",
  supportPhone: "+91 00000 00000",
  privacyPolicyUrl: "",
  termsUrl: "",
  hidePlatformBranding: false,
};

export const defaultSettings: TenantSettings = {
  timezone: "Asia/Kolkata",
  defaultLanguage: "en",
  enabledLanguages: ["en", "hi", "hinglish"],
  businessHours: {
    monday: { open: "09:00", close: "18:00" },
    tuesday: { open: "09:00", close: "18:00" },
    wednesday: { open: "09:00", close: "18:00" },
    thursday: { open: "09:00", close: "18:00" },
    friday: { open: "09:00", close: "18:00" },
    saturday: { open: "09:00", close: "13:00" },
    sunday: { open: "09:00", close: "18:00", closed: true },
  },
  requiredSupportFields: ["name", "email", "equipmentId"],
  escalationBehavior: "safety-and-low-confidence",
  confidenceThreshold: 0.72,
};
