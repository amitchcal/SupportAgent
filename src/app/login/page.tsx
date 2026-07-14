import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { readDatabase } from "@/lib/store";
import { initializePlatform, login } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/admin");
  const database = await readDatabase(); const isFirstRun = database.users.length === 0; const error = (await searchParams).error;
  return <main className="login-grid"><section className="login-side"><span className="eyebrow">RESOLVEOPS CONTROL CENTRE</span><h1>Support that<br />knows the rules.</h1><p>Configure tenant-safe, approved support experiences for every organization—from branding to access control.</p></section><section className="login-form"><form action={isFirstRun ? initializePlatform : login}><span className="eyebrow">{isFirstRun ? "FIRST-RUN SETUP" : "SECURE ADMIN ACCESS"}</span><h2>{isFirstRun ? "Create the platform owner" : "Welcome back"}</h2><p className="muted">{isFirstRun ? "This privileged account can only be created once." : "Sign in with your administrator account."}</p>{error && <p className="error">Email or password is incorrect.</p>}{isFirstRun && <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" required /></div>}<div className="field"><label htmlFor="email">Work email</label><input id="email" name="email" type="email" required autoComplete="email" /></div><div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={12} required autoComplete={isFirstRun ? "new-password" : "current-password"} /></div><button className="primary full">{isFirstRun ? "Initialize securely" : "Sign in"}</button></form></section></main>;
}
