import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserById } from "./store";
import { verifySessionToken } from "./security";

export const SESSION_COOKIE = "support_agent_session";

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = token ? verifySessionToken(token) : null;
  if (!claims) return null;
  const user = await findUserById(claims.userId);
  return user?.status === "ACTIVE" ? user : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
