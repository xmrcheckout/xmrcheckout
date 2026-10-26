import { NextResponse, type NextRequest } from "next/server";

import { hasValidMultipartBoundary } from "./lib/multipart";

export function proxy(request: NextRequest) {
  if (
    request.method === "POST"
    && !hasValidMultipartBoundary(request.headers.get("content-type"))
  ) {
    return new NextResponse("Invalid multipart boundary.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.next();
}
