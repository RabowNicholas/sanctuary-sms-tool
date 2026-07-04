import { getProduct } from "@/lib/blog/products";

/**
 * A single affiliate product callout. Usage in MDX: <ProductCard id="loop-experience" />
 * The CTA routes through /go/[id] and carries rel="sponsored nofollow".
 */
export function ProductCard({
  id,
  cta = "Check price",
}: {
  id: string;
  cta?: string;
}) {
  const product = getProduct(id);
  if (!product) {
    return (
      <div className="my-6 rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">
        Unknown product id: <code>{id}</code>
      </div>
    );
  }

  return (
    <div className="my-6 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-fuchsia-400">
          {product.brand}
        </p>
        <p className="mt-1 text-lg font-semibold text-white">{product.name}</p>
        <p className="mt-1 text-sm text-zinc-400">
          ~${product.priceApprox.toFixed(2)}
        </p>
      </div>
      <a
        href={`/go/${product.id}`}
        target="_blank"
        rel="sponsored nofollow noopener"
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-fuchsia-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
      >
        {cta}
      </a>
    </div>
  );
}
