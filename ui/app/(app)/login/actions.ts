"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dashboardDestination } from "../../../lib/wallet-connection";
import { getI18n } from "../../../lib/i18n/server";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";

export type LoginState = {
  error: string | null;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const { t } = await getI18n();
  const paymentAddress = String(formData.get("payment_address") ?? "").trim();
  const viewKey = String(formData.get("view_key") ?? "").trim();

  if (!paymentAddress || !viewKey) {
    return { error: t("login.required") };
  }

  const response = await fetch(`${apiBaseUrl}/api/core/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment_address: paymentAddress, view_key: viewKey }),
    cache: "no-store",
  }).catch(() => new Response(null, { status: 503 }));

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? t("login.unableToConnect");
    return { error: message };
  }

  const data = (await response.json()) as {
    api_key: string;
    webhook_secret: string;
    store_id?: string;
  };

  const cookieStore = await cookies();
  cookieStore.set("xmrcheckout_api_key", data.api_key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  cookieStore.set("xmrcheckout_webhook_secret", data.webhook_secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect(dashboardDestination(formData.get("next")));
}
