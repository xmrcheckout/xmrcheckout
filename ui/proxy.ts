import { NextResponse, type NextRequest } from "next/server";

import { hasValidMultipartBoundary } from "./lib/multipart";

export async function proxy(request: NextRequest) {
  if (
    request.method === "POST" &&
    !hasValidMultipartBoundary(request.headers.get("content-type"))
  ) {
    return new NextResponse("Invalid multipart boundary.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // A normal rendered route keeps link errors readable without JavaScript.
  // Next's dynamic notFound() fallback can otherwise send an empty HTML body.
  const unavailablePages = ["/invoice-link-unavailable", "/payment-link-unavailable", "/i-link-unavailable"];
  if (unavailablePages.includes(request.nextUrl.pathname)) {
    return NextResponse.rewrite(request.nextUrl, { status: 404 });
  }
  const publicLink = request.nextUrl.pathname.match(/^\/(invoice|pay|i)\/([^/]+)(\/receipt)?\/?$/);
  // Data requests use Next's native error flow; only documents need HTML.
  if (["GET", "HEAD"].includes(request.method) && !request.headers.has("rsc") && publicLink) {
    const [, kind, id, receipt] = publicLink;
    if (receipt && kind !== "i") return NextResponse.next();
    let decodedId = id;
    try { decodedId = decodeURIComponent(id); } catch { /* The API rejects malformed IDs. */ }
    const endpoint = kind === "pay" ? "payment-links" : "invoice";
    const base = process.env.API_BASE_URL ?? "http://localhost:8000";
    const response = await fetch(`${base}/api/core/public/${endpoint}/${encodeURIComponent(decodedId)}`, {
      cache: "no-store",
    }).catch(() => null);
    const unavailable = response?.status === 404 || response?.status === 422;
    await response?.arrayBuffer().catch(() => undefined);
    if (unavailable) {
      const url = request.nextUrl.clone();
      url.pathname = kind === "i" ? "/i-link-unavailable" : kind === "invoice" ? "/invoice-link-unavailable" : "/payment-link-unavailable";
      url.search = "";
      if (kind === "i") {
        url.searchParams.set("invoice", decodedId);
        if (response?.status === 422) url.searchParams.set("invalid", "1");
        if (receipt) url.searchParams.set("receipt", "1");
      }
      return NextResponse.rewrite(url, { status: 404 });
    }
  }

  return NextResponse.next();
}
