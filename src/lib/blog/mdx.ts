import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { postFrontmatterSchema, type PostFrontmatter } from "./schema";
import { getProduct } from "./products";

/**
 * File-based MDX blog loader.
 *
 * Why next-mdx-remote (not Velite / @next/mdx): posts are plain data files
 * compiled at request/build time, so a new .mdx file appears with zero code
 * changes, there is no webpack loader to configure (works with `next build
 * --turbopack`), and no concurrent content-build watcher to bolt onto the
 * existing Prisma+turbopack build script. gray-matter parses frontmatter; zod
 * validates it; MDXRemote (rsc) renders the body in the page.
 */

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface LoadedPost {
  frontmatter: PostFrontmatter;
  /** Raw MDX body (frontmatter stripped) — fed to <MDXRemote/>. */
  content: string;
}

function readAndValidate(fileName: string): LoadedPost {
  const filePath = path.join(BLOG_DIR, fileName);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  const parsed = postFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid frontmatter in content/blog/${fileName}:\n${issues}`
    );
  }

  const frontmatter = parsed.data;

  // Fail fast if a post references a product id that doesn't exist.
  for (const id of frontmatter.products) {
    if (!getProduct(id)) {
      throw new Error(
        `content/blog/${fileName}: unknown product id "${id}" (not in content/products/products.ts)`
      );
    }
  }

  // Guard against slug/filename drift so URLs are predictable.
  const expectedSlug = fileName.replace(/\.mdx$/, "");
  if (frontmatter.slug !== expectedSlug) {
    throw new Error(
      `content/blog/${fileName}: frontmatter slug "${frontmatter.slug}" must match filename "${expectedSlug}"`
    );
  }

  return { frontmatter, content };
}

function listFiles(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
}

/** All posts (drafts included), newest first. */
export function getAllPosts(): LoadedPost[] {
  return listFiles()
    .map(readAndValidate)
    .sort(
      (a, b) =>
        b.frontmatter.publishedAt.getTime() -
        a.frontmatter.publishedAt.getTime()
    );
}

/** Published posts only — used by the index and sitemap. */
export function getPublishedPosts(): LoadedPost[] {
  return getAllPosts().filter((p) => p.frontmatter.status === "published");
}

/**
 * A single post by slug. Drafts are returned in development (direct-URL
 * preview) but treated as not-found in production.
 */
export function getPostBySlug(slug: string): LoadedPost | null {
  const fileName = `${slug}.mdx`;
  if (!fs.existsSync(path.join(BLOG_DIR, fileName))) return null;
  const post = readAndValidate(fileName);
  if (
    post.frontmatter.status !== "published" &&
    process.env.NODE_ENV === "production"
  ) {
    return null;
  }
  return post;
}

/** Slugs for generateStaticParams — published only (drafts aren't prebuilt). */
export function getPublishedSlugs(): string[] {
  return getPublishedPosts().map((p) => p.frontmatter.slug);
}
