/**
 * FTC affiliate disclosure. Auto-rendered above the fold by the post page when
 * frontmatter `affiliateDisclosure: true`, and also usable inline in MDX.
 */
export function FTCDisclosure() {
  return (
    <aside
      role="note"
      className="my-6 rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400"
    >
      <span className="font-semibold text-zinc-200">Heads up:</span> some links
      below are affiliate links. If you buy through them we may earn a small
      commission at no extra cost to you. We only recommend gear we&apos;d
      actually bring to a show.
    </aside>
  );
}
