import { cookies } from "next/headers";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";

// Errors go back to the dashboard instead of showing raw API text in a new page.
const goTo = (location: string) =>
  new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store" } });
const exportFailed = () => goTo("/dashboard?tab=invoices&export_failed=1");
const sessionEnded = () => goTo(`/session-ended?next=${encodeURIComponent("/dashboard?tab=invoices")}`);

export async function GET(request: Request) {
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return sessionEnded();
  }

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${apiBaseUrl}/api/core/invoices/export.csv`);
  sourceUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const response = await fetch(targetUrl.toString(), {
    headers: { Authorization: `ApiKey ${apiKey}` },
    cache: "no-store",
  }).catch(() => null);

  if (response?.status === 401) {
    return sessionEnded();
  }
  if (!response?.ok) {
    return exportFailed();
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
