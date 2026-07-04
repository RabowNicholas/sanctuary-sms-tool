import type { ReactNode } from "react";

/**
 * First-hand experience block — the editorial guardrail. AI drafts the post
 * structure; this component frames the founder's REAL, lived detail and real
 * event photos so the post isn't generic. The human fills the children (and
 * drops a real photo into /public/blog-images, referenced via the `photo` prop).
 *
 * Usage in MDX:
 * <Experience where="Das Energi, Salt Lake" when="Aug 2025" photo="/blog-images/das-energi.jpg">
 *   I wore the Loops for a 9-hour day and...
 * </Experience>
 */
export function Experience({
  where,
  when,
  photo,
  photoAlt,
  children,
}: {
  where: string;
  when: string;
  photo?: string;
  photoAlt?: string;
  children: ReactNode;
}) {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border border-fuchsia-500/30 bg-zinc-900/60">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-3 text-xs font-medium uppercase tracking-widest text-fuchsia-400">
        <span aria-hidden>◈</span>
        <span>
          From the floor — {where} · {when}
        </span>
      </div>
      {photo ? (
        // Real event photo; plain <img> keeps MDX authoring simple (no width/height needed).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={photoAlt || `${where}, ${when}`}
          className="max-h-96 w-full object-cover"
        />
      ) : null}
      <figcaption className="px-5 py-4 text-zinc-300 [&>p]:my-3 [&>p]:leading-7">
        {children}
      </figcaption>
    </figure>
  );
}
