import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getPostBySlug, getPublishedSlugs } from "@/lib/blog/mdx";
import { buildPostMetadata, buildJsonLd } from "@/lib/blog/seo";
import { mdxComponents } from "@/components/blog/mdx-components";
import { FTCDisclosure } from "@/components/blog/FTCDisclosure";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Prebuild every published post at build time (drafts render on demand in dev).
export function generateStaticParams() {
  return getPublishedSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return buildPostMetadata(post);
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { frontmatter: fm, content } = post;
  const jsonLd = buildJsonLd(post);

  return (
    <article className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      {jsonLd.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          // JSON-LD is trusted, build-time data derived from validated frontmatter.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}

      <header className="mb-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-fuchsia-400">
          {fm.category}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {fm.title}
        </h1>
        <p className="mt-4 text-lg text-zinc-400">{fm.description}</p>
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
          <span>{fm.author}</span>
          <span aria-hidden>·</span>
          <time dateTime={fm.publishedAt.toISOString()}>
            {DATE_FMT.format(fm.publishedAt)}
          </time>
        </div>
      </header>

      <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-xl border border-zinc-800">
        <Image
          src={fm.hero.src}
          alt={fm.hero.alt}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
        {fm.hero.credit ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-zinc-300">
            {fm.hero.credit}
          </span>
        ) : null}
      </div>

      {/* Disclosure renders above the fold whenever the post carries affiliate links. */}
      {fm.affiliateDisclosure ? <FTCDisclosure /> : null}

      <div className="blog-prose">
        <MDXRemote source={content} components={mdxComponents} />
      </div>
    </article>
  );
}
