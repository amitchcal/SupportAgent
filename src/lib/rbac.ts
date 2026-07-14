import type { Role } from "./domain";

export type Permission =
  | "tenants:manage"
  | "settings:manage"
  | "users:manage"
  | "knowledge:manage"
  | "integrations:manage"
  | "reports:read"
  | "conversations:read"
  | "audit:read";

const grants: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ["tenants:manage", "settings:manage", "users:manage", "knowledge:manage", "integrations:manage", "reports:read", "conversations:read", "audit:read"],
  TENANT_ADMIN: ["settings:manage", "users:manage", "knowledge:manage", "integrations:manage", "reports:read", "conversations:read", "audit:read"],
  KNOWLEDGE_MANAGER: ["knowledge:manage"],
  INTEGRATION_ADMIN: ["integrations:manage"],
  SUPPORT_SUPERVISOR: ["reports:read", "conversations:read"],
  VIEWER: ["reports:read", "conversations:read"],
};

export function can(role: Role, permission: Permission) {
  return grants[role].includes(permission);
}

export function assertCan(role: Role, permission: Permission) {
  if (!can(role, permission)) throw new Error("Forbidden");
}

export function scopeTenant(role: Role, actorTenantId: string | null, requestedTenantId?: string) {
  if (role === "SUPER_ADMIN") {
    if (!requestedTenantId) throw new Error("A tenant must be selected.");
    return requestedTenantId;
  }
  if (!actorTenantId) throw new Error("Tenant context is missing.");
  if (requestedTenantId && requestedTenantId !== actorTenantId) throw new Error("Forbidden");
  return actorTenantId;
}
