import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getPublishedPosts } from "@/lib/blog/mdx";
import { POST_CATEGORIES } from "@/lib/blog/schema";

export const metadata: Metadata = {
  title: "Field Notes",
  alternates: { canonical: "/blog" },
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

interface PageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const { category } = await searchParams;
  const all = getPublishedPosts(); // already newest-first
  const posts = category
    ? all.filter((p) => p.frontmatter.category === category)
    : all;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Field Notes
      </h1>
      <p className="mt-3 text-lg text-zinc-400">
        Gear, prep, and culture — tested on the floor, not in theory.
      </p>

      {/* Category filter */}
      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Filter by category">
        <FilterChip label="All" href="/blog" active={!category} />
        {POST_CATEGORIES.map((c) => (
          <FilterChip
            key={c}
            label={c}
            href={`/blog?category=${c}`}
            active={category === c}
          />
        ))}
      </nav>

      <ul className="mt-10 space-y-10">
        {posts.length === 0 ? (
          <li className="text-zinc-500">No posts in this category yet.</li>
        ) : (
          posts.map(({ frontmatter: fm }) => (
            <li key={fm.slug}>
              <Link href={`/blog/${fm.slug}`} className="group block">
                <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-xl border border-zinc-800">
                  <Image
                    src={fm.hero.src}
                    alt={fm.hero.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <p className="text-xs font-medium uppercase tracking-widest text-fuchsia-400">
                  {fm.category} ·{" "}
                  <time dateTime={fm.publishedAt.toISOString()}>
                    {DATE_FMT.format(fm.publishedAt)}
                  </time>
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white group-hover:text-fuchsia-300">
                  {fm.title}
                </h2>
                <p className="mt-2 text-zinc-400">{fm.description}</p>
              </Link>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-sm capitalize transition ${
        active
          ? "border-fuchsia-500 bg-fuchsia-600 text-white"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      }`}
    >
      {label}
    </Link>
  );
}
