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
export type ConversationStatus = "AWAITING_CLARIFICATION" | "AWAITING_CONFIRMATION" | "ESCALATED";
export type Conversation = { id: string; tenantId: string; language: SupportedLanguage; contact: Record<string, string>; issue: IssueDetails; classification: Classification; safetyReasons: string[]; lowConfidenceReason: string | null; clarificationCount: number; status: ConversationStatus; createdAt: string; updatedAt: string };
export type ConversationMessage = { id: string; tenantId: string; conversationId: string; role: "USER" | "ASSISTANT" | "SYSTEM"; content: string; createdAt: string };
export type KnowledgeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED" | "REJECTED";
export type KnowledgeDocument = { id: string; tenantId: string; title: string; description: string; tags: string[]; status: KnowledgeStatus; currentVersionId: string | null; createdBy: string; createdAt: string; updatedAt: string };
export type KnowledgeVersion = { id: string; tenantId: string; documentId: string; version: number; fileName: string; fileType: "pdf" | "docx" | "txt" | "md" | "html"; storagePath: string; checksum: string; status: KnowledgeStatus; chunks: string[]; createdBy: string; approvedBy: string | null; createdAt: string; approvedAt: string | null };

export type Database = { tenants: Tenant[]; users: User[]; auditLogs: AuditLog[]; conversations: Conversation[]; conversationMessages: ConversationMessage[]; knowledgeDocuments: KnowledgeDocument[]; knowledgeVersions: KnowledgeVersion[] };

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
