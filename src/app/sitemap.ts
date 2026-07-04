import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog/mdx";
import { SITE_URL, postUrl } from "@/lib/blog/seo";

/**
 * XML sitemap. Only published posts are included — drafts are excluded via
 * getPublishedPosts().
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPublishedPosts().map((p) => ({
    url: postUrl(p.frontmatter.slug),
    lastModified: p.frontmatter.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...posts,
  ];
}
