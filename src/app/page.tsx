import Link from "next/link";
import { findTenantBySlug } from "@/lib/store";
import { themeStyle } from "@/lib/theme";

export default async function Home({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const slug = (await searchParams).tenant ?? "acme";
  const tenant = await findTenantBySlug(slug);
  if (!tenant) return <main className="center"><section className="card"><h1>Support portal unavailable</h1><p>Please check the organization link.</p></section></main>;
  return (
    <main className="public-shell" style={themeStyle(tenant.theme)}>
      <nav><span className="brand-mark">{tenant.branding.logoUrl ? <>
        {/* eslint-disable-next-line @next/next/no-img-element -- tenant-managed URL and host are runtime configuration */}
        <img src={tenant.branding.logoUrl} alt="" />
      </> : tenant.branding.productDisplayName.slice(0, 1)}</span><strong>{tenant.branding.productDisplayName}</strong><Link href="/login">Admin portal</Link></nav>
      <section className="hero">
        <div><span className="eyebrow">24/7 EQUIPMENT SUPPORT</span><h1>Get back to work.<br /><em>Safely.</em></h1><p>{tenant.branding.supportAgentName} follows approved troubleshooting procedures and escalates whenever human expertise is needed.</p><button>Start a support session <span>→</span></button><small>English · हिन्दी · Hinglish</small></div>
        <article className="chat-preview"><header><span className="avatar">{tenant.branding.supportAgentName.slice(0, 1)}</span><div><b>{tenant.branding.supportAgentName}</b><small>AI support agent · Online</small></div></header><div className="message">Hello. I’m here to help with your equipment issue. Before we begin, is anyone in immediate danger?</div><div className="quick-row"><span>No immediate danger</span><span>Yes — urgent</span></div><footer>Describe the equipment issue… <b>↑</b></footer></article>
      </section>
      <footer className="public-footer"><span>{tenant.branding.companyDisplayName}</span><span>{tenant.branding.footerText}</span><span>{tenant.branding.supportEmail}</span></footer>
    </main>
  );
}
