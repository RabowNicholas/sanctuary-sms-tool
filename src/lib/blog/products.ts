import { products, type Product } from "../../../content/products/products";

export type { Product };

const byId = new Map(products.map((p) => [p.id, p]));

/** Look up a product by id, or undefined if unknown. */
export function getProduct(id: string): Product | undefined {
  return byId.get(id);
}

/** Resolve a list of ids to products, throwing on any unknown id. */
export function getProducts(ids: string[]): Product[] {
  return ids.map((id) => {
    const p = byId.get(id);
    if (!p) throw new Error(`Unknown product id: "${id}"`);
    return p;
  });
}

export { products };
