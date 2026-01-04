import { cookies } from "next/headers";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${apiBaseUrl}/api/core/invoices/export.csv`);
  sourceUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const response = await fetch(targetUrl.toString(), {
    headers: { Authorization: `ApiKey ${apiKey}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "Unable to export invoices.");
    return new Response(message, { status: response.status });
  }

  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("content-type") ?? "text/csv");
  const disposition = response.headers.get("content-disposition");
  headers.set(
    "Content-Disposition",
    disposition ?? 'attachment; filename="invoices.csv"'
  );

  return new Response(response.body, { status: 200, headers });
}

