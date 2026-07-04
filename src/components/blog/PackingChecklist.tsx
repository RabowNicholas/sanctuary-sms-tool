/**
 * A simple visual checklist. Usage in MDX:
 * <PackingChecklist items={["Earplugs","Hydration mix","Reusable bottle"]} />
 */
export function PackingChecklist({ items }: { items: string[] }) {
  return (
    <ul className="my-8 grid gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-zinc-300">
          <span
            aria-hidden
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-fuchsia-500/60 text-xs text-fuchsia-400"
          >
            ✓
          </span>
          <span className="leading-6">{item}</span>
        </li>
      ))}
    </ul>
  );
}
