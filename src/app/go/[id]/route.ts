import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/blog/products";

/**
 * Affiliate outbound redirect.
 *
 * Standalone and stateless by design: it reads the single-source-of-truth
 * product table and 302-redirects to the product's affiliate URL. No DB, no
 * Prisma — deliberately decoupled from the SMS tool's /rd click-tracking
 * (which logs to Postgres). The redirect pattern (302 + bot-safe handling)
 * mirrors src/app/rd/[code]/route.ts, but none of its infra is imported.
 *
 * `rel="sponsored"` lives on the <a> tags in ProductCard/ComparisonTable that
 * point here; this response adds X-Robots-Tag: noindex so the redirect URL
 * itself never gets indexed.
 */

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const product = getProduct(id);

  if (!product) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "X-Robots-Tag": "noindex" },
    });
  }

  // Placeholder links aren't live yet — send the user somewhere real rather
  // than to a "#TODO-..." dead URL.
  if (product.affiliateUrl.startsWith("#TODO")) {
    return new NextResponse(
      `Affiliate link for "${product.name}" is not configured yet.`,
      { status: 503, headers: { "X-Robots-Tag": "noindex" } }
    );
  }

  return NextResponse.redirect(product.affiliateUrl, {
    status: 302,
    headers: { "X-Robots-Tag": "noindex" },
  });
}
