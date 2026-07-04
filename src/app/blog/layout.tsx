import Link from "next/link";
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/blog/seo";

/**
 * Public chrome for the whole /blog section. Deliberately separate from the
 * dashboard nav (which lives in dashboard/layout.tsx) and forces the dark
 * "underground" reading surface — globals.css is light-first, so the blog
 * establishes its own theme here rather than inheriting one.
 */

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Field Notes`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Honest gear, prep, and culture notes from the Flow State floor.",
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link
            href="/blog"
            className="text-sm font-bold uppercase tracking-[0.2em] text-white"
          >
            Flow State
          </Link>
          <span className="text-xs uppercase tracking-widest text-zinc-500">
            Field Notes
          </span>
        </div>
      </header>

      {children}

      <footer className="border-t border-zinc-900">
        <div className="mx-auto max-w-3xl px-5 py-8 text-sm text-zinc-500">
          <p>
            © {SITE_NAME}. We use affiliate links; see individual posts for
            disclosures.
          </p>
        </div>
      </footer>
    </div>
  );
}
