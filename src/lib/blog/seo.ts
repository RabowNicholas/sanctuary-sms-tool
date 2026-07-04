import type { Metadata } from "next";
import type { LoadedPost } from "./mdx";
import { getProducts, type Product } from "./products";

/**
 * Public base URL of the site. Override via NEXT_PUBLIC_SITE_URL in the env
 * (must match the domain that actually serves this deploy). Canonical URLs,
 * OpenGraph, sitemap and JSON-LD all derive from this.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://flowstateslc.live"
).replace(/\/$/, "");

export const SITE_NAME = "Flow State";

export function postUrl(slug: string): string {
  return `${SITE_URL}/blog/${slug}`;
}

function abs(src: string): string {
  return src.startsWith("http") ? src : `${SITE_URL}${src}`;
}

/** Per-post <head>: title, description, canonical, OpenGraph, Twitter. */
export function buildPostMetadata(post: LoadedPost): Metadata {
  const { frontmatter: fm } = post;
  const url = postUrl(fm.slug);
  const image = abs(fm.hero.src);

  return {
    title: fm.title,
    description: fm.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: fm.title,
      description: fm.description,
      siteName: SITE_NAME,
      publishedTime: fm.publishedAt.toISOString(),
      modifiedTime: fm.updatedAt.toISOString(),
      authors: [fm.author],
      images: [{ url: image, alt: fm.hero.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: fm.title,
      description: fm.description,
      images: [image],
    },
  };
}

function articleJsonLd(post: LoadedPost) {
  const { frontmatter: fm } = post;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: fm.title,
    description: fm.description,
    image: [abs(fm.hero.src)],
    datePublished: fm.publishedAt.toISOString(),
    dateModified: fm.updatedAt.toISOString(),
    author: { "@type": "Person", name: fm.author },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl(fm.slug) },
    keywords: [...fm.tags, ...fm.pinterestKeywords].join(", "),
  };
}

function productJsonLd(p: Product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    brand: { "@type": "Brand", name: p.brand },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: p.priceApprox,
      url: `${SITE_URL}/go/${p.id}`,
    },
  };
}

function itemListJsonLd(post: LoadedPost, prods: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: post.frontmatter.title,
    itemListElement: prods.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      url: `${SITE_URL}/go/${p.id}`,
    })),
  };
}

/**
 * JSON-LD graph for a post: always an Article; a Product/ItemList for
 * money-audition roundups so the review can win rich results.
 */
export function buildJsonLd(post: LoadedPost): object[] {
  const graph: object[] = [articleJsonLd(post)];
  const prods = getProducts(post.frontmatter.products);

  if (post.frontmatter.funnelRole === "money-audition" && prods.length > 0) {
    if (prods.length > 1) {
      graph.push(itemListJsonLd(post, prods));
    }
    // Emit Product schema for each reviewed product.
    for (const p of prods) graph.push(productJsonLd(p));
  }

  return graph;
}
