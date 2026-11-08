import { cookies } from "next/headers";

import { dashboardDestination } from "../../../lib/wallet-connection";

// The API rejected the saved key (for example after a reset). Pages cannot change
// cookies while rendering, so the dashboard sends the browser here to drop the stale
// sign-in before asking the merchant to connect again.
export async function GET(request: Request) {
  const cookieStore = await cookies();
  for (const name of ["xmrcheckout_api_key", "xmrcheckout_webhook_secret"]) {
    cookieStore.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
  const next = dashboardDestination(new URL(request.url).searchParams.get("next"));
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/?login=1&expired=1&next=${encodeURIComponent(next)}`,
      "Cache-Control": "no-store",
    },
  });
}
