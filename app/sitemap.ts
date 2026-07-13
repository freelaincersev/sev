import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl;
  return [
    // Only public pages that actually exist. Right now that's the landing (/).
    // /login is public but a utility page (kept out of the sitemap on purpose).
    // Add new public pages here one line at a time as they ship.
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    // Private routes (/dashboard, /projects, /auth) MUST NOT be listed here.
  ];
}
