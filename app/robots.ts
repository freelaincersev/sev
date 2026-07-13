import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // robots.txt is only guidance for crawlers — it is NOT a security control.
  // /dashboard, /projects, and /auth are actually protected by Supabase Auth,
  // RLS (auth.uid() = user_id), and route guards in proxy.ts — never by this file.
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/projects/", "/auth/"],
    },
    sitemap: "https://sev.app/sitemap.xml",
  };
}
