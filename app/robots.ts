import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

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
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
