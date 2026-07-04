import { getProducts } from "@/lib/blog/products";

/**
 * Side-by-side product comparison. Usage in MDX:
 * <ComparisonTable ids={["loop-experience","eargasm-hifi","alpine-partyplug"]} />
 */
export function ComparisonTable({ ids }: { ids: string[] }) {
  const products = getProducts(ids);

  return (
    <div className="my-8 overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-400">
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 font-medium">Brand</th>
            <th className="px-4 py-3 font-medium">Price</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {products.map((p) => (
            <tr key={p.id} className="text-zinc-300">
              <td className="px-4 py-3 font-medium text-white">{p.name}</td>
              <td className="px-4 py-3">{p.brand}</td>
              <td className="px-4 py-3">~${p.priceApprox.toFixed(2)}</td>
              <td className="px-4 py-3">
                <a
                  href={`/go/${p.id}`}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="font-medium text-fuchsia-400 underline decoration-fuchsia-400/40 underline-offset-2 hover:decoration-fuchsia-400"
                >
                  Check price
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
