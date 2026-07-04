import { z } from "zod";

/**
 * Frontmatter contract for every post in content/blog/*.mdx.
 *
 * This is the single source of truth for what a valid post looks like. The
 * loader (src/lib/blog/mdx.ts) runs `postFrontmatterSchema.parse()` on every
 * file at load time, and because pages import the loader, an invalid post
 * throws during `next build` with a clear zod error — a bad post can never
 * ship to production.
 */

export const POST_CATEGORIES = [
  "gear",
  "outfits",
  "makeup",
  "kandi",
  "harm-reduction",
  "culture",
] as const;

export const FUNNEL_ROLES = [
  "reach",
  "money-audition",
  "hub",
  "email-engine",
  "differentiator",
] as const;

export const POST_STATUSES = ["draft", "published"] as const;

export const postFrontmatterSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().max(160, "description must be <= 160 chars for SEO"),
  // YAML dates arrive as Date objects; string dates are coerced too.
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  author: z.string().min(1),
  category: z.enum(POST_CATEGORIES),
  tags: z.array(z.string()).default([]),
  hero: z.object({
    src: z.string().min(1),
    alt: z.string().min(1),
    credit: z.string().default(""),
  }),
  // Product ids that must exist in content/products/products.ts.
  products: z.array(z.string()).default([]),
  pinterestKeywords: z.array(z.string()).default([]),
  funnelRole: z.enum(FUNNEL_ROLES),
  affiliateDisclosure: z.boolean().default(false),
  status: z.enum(POST_STATUSES).default("draft"),
});

export type PostCategory = (typeof POST_CATEGORIES)[number];
export type FunnelRole = (typeof FUNNEL_ROLES)[number];
export type PostStatus = (typeof POST_STATUSES)[number];
export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;
