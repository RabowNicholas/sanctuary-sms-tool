import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { FTCDisclosure } from "./FTCDisclosure";
import { ProductCard } from "./ProductCard";
import { ComparisonTable } from "./ComparisonTable";
import { PackingChecklist } from "./PackingChecklist";
import { EmailOptin } from "./EmailOptin";
import { Experience } from "./Experience";
import { ProTip, FieldNote } from "./Callouts";

/**
 * The component map handed to <MDXRemote/>. Everything here is usable directly
 * in any .mdx post with no per-post import. Base HTML elements are styled to
 * match the blog's dark reading surface (no typography plugin needed).
 */
export const mdxComponents: MDXComponents = {
  // --- prose base elements ---
  h2: (props) => (
    <h2
      className="mt-12 mb-4 text-2xl font-bold tracking-tight text-white sm:text-3xl"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="mt-8 mb-3 text-xl font-semibold tracking-tight text-white"
      {...props}
    />
  ),
  p: (props) => (
    <p className="my-5 text-base leading-7 text-zinc-300" {...props} />
  ),
  ul: (props) => (
    <ul
      className="my-5 list-disc space-y-2 pl-6 text-zinc-300 marker:text-fuchsia-400"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="my-5 list-decimal space-y-2 pl-6 text-zinc-300 marker:text-fuchsia-400"
      {...props}
    />
  ),
  li: (props) => <li className="leading-7" {...props} />,
  a: ({ href = "#", ...props }) => {
    const isAffiliate = href.startsWith("/go/");
    const className =
      "font-medium text-fuchsia-400 underline decoration-fuchsia-400/40 underline-offset-2 transition hover:decoration-fuchsia-400";
    // Any link into /go/ is an affiliate link, even inline in prose — mark it.
    if (isAffiliate) {
      return (
        <a
          href={href}
          target="_blank"
          rel="sponsored nofollow noopener"
          className={className}
          {...props}
        />
      );
    }
    return <Link href={href} className={className} {...props} />;
  },
  blockquote: (props) => (
    <blockquote
      className="my-6 border-l-2 border-fuchsia-500 pl-4 text-lg italic text-zinc-200"
      {...props}
    />
  ),
  hr: () => <hr className="my-10 border-zinc-800" />,
  strong: (props) => <strong className="font-semibold text-white" {...props} />,
  code: (props) => (
    <code
      className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-sm text-fuchsia-300"
      {...props}
    />
  ),

  // --- custom blog components (usable directly in MDX) ---
  FTCDisclosure,
  ProductCard,
  ComparisonTable,
  PackingChecklist,
  EmailOptin,
  Experience,
  ProTip,
  FieldNote,
};
