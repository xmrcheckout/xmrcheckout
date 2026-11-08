"use server";

import { dashboardMutationError } from "../../../lib/dashboard-request";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getI18n } from "../../../lib/i18n/server";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";

export type InvoiceState = {
  code?: string | null;
  diagnosticId?: string | null;
  retryAfterSeconds?: number | null;
  creationAttemptId?: string;
  error: string | null;
  invoiceId: string | null;
  address: string | null;
  amount: string | null;
  recipientName: string | null;
  description: string | null;
  subaddressIndex: number | null;
  warnings: string[] | null;
};

export type ApiKeyState = {
  apiKey: string;
  error: string | null;
};

export type InvoiceTransfersState = {
  transfers: Array<{
    txid: string;
    amount_xmr: string;
    confirmations: number;
    timestamp: number | null;
  }>;
  error: string | null;
};

export type WebhookSecretState = {
  webhookSecret: string | null;
  error: string | null;
};

export type WebhookFormState = {
  error: string | null;
  success: string | null;
};

export type ArchiveInvoiceState = {
  error: string | null;
  success: string | null;
  archivedId: string | null;
};

export type BtcpayCheckoutPreferenceState = {
  style: "standard" | "btcpay_classic";
  error: string | null;
  success: string | null;
};

export type DefaultConfirmationTargetState = {
  value: number;
  error: string | null;
  success: string | null;
};

export type DefaultQrLogoState = {
  logo: "monero" | "none" | "custom";
  logoDataUrl: string | null;
  error: string | null;
  success: string | null;
};

export type WebhookRedeliverState = {
  error: string | null;
  success: string | null;
};

export async function createInvoiceTourAction(
  _prevState: InvoiceState,
  _formData: FormData
): Promise<InvoiceState> {
  const { t } = await getI18n();
  return {
    error: t("dashboard.actions.tourNoop"),
    invoiceId: null,
    address: null,
    amount: null,
    recipientName: null,
    description: null,
    subaddressIndex: null,
    warnings: null,
  };
}

export async function archiveInvoiceTourAction(
  _prevState: ArchiveInvoiceState,
  formData: FormData
): Promise<ArchiveInvoiceState> {
  const { t } = await getI18n();
  const archivedId = String(formData.get("invoice_id") ?? "").trim() || null;
  return {
    error: null,
    success: t("dashboard.actions.tourNoop"),
    archivedId,
  };
}

export async function createWebhookTourAction(
  _prevState: WebhookFormState,
  _formData: FormData
): Promise<WebhookFormState> {
  const { t } = await getI18n();
  return { error: null, success: t("dashboard.actions.tourNoop") };
}

export async function deleteWebhookTourAction(
  _prevState: WebhookFormState,
  _formData: FormData
): Promise<WebhookFormState> {
  const { t } = await getI18n();
  return { error: null, success: t("dashboard.actions.tourNoop") };
}

export async function redeliverWebhookDeliveryTourAction(
  _prevState: WebhookRedeliverState,
  _formData: FormData
): Promise<WebhookRedeliverState> {
  const { t } = await getI18n();
  return { error: null, success: t("dashboard.actions.tourNoop") };
}

const webhookEventKeys = [
  { event: "invoice.created", key: "invoice_created" },
  { event: "invoice.partially_paid", key: "invoice_partially_paid" },
  { event: "invoice.payment_detected", key: "invoice_payment_detected" },
  { event: "invoice.confirmed", key: "invoice_confirmed" },
  { event: "invoice.expired", key: "invoice_expired" },
] as const;

export async function createInvoiceAction(
  _prevState: InvoiceState,
  formData: FormData
): Promise<InvoiceState> {
  const { t } = await getI18n();
  const amountMode = String(formData.get("amount_mode") ?? "xmr").trim();
  const isFiat = amountMode === "fiat";
  const instantConfirmation = formData.get("instant_confirmation") === "1";
  const confirmationRaw = String(formData.get("confirmation_target") ?? "").trim();
  let confirmationTarget: number | null = null;
  if (instantConfirmation) {
    confirmationTarget = 0;
  } else if (confirmationRaw) {
    const parsed = Number(confirmationRaw);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 10) {
      return {
        error: t("dashboard.actions.targetRange"),
        invoiceId: null,
        address: null,
        amount: null,
        recipientName: null,
        description: null,
        subaddressIndex: null,
        warnings: null,
      };
    }
    confirmationTarget = parsed;
  }
  const amountRaw = String(
    formData.get(isFiat ? "amount_fiat" : "amount_xmr") ?? ""
  ).trim();
  const amount = Number(amountRaw);
  if (Number.isNaN(amount) || amount <= 0) {
    return {
      error: isFiat ? t("dashboard.actions.invalidFiat") : t("dashboard.actions.invalidXmr"),
      invoiceId: null,
      address: null,
      amount: null,
      recipientName: null,
      description: null,
      subaddressIndex: null,
      warnings: null,
    };
  }
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  if (isFiat && !currency) {
    return {
      error: t("dashboard.actions.currencyRequired"),
      invoiceId: null,
      address: null,
      amount: null,
      recipientName: null,
      description: null,
      subaddressIndex: null,
      warnings: null,
    };
  }
  const recipientName = String(formData.get("recipient_name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const checkoutContinueUrlRaw = String(formData.get("checkout_continue_url") ?? "").trim();
  if (checkoutContinueUrlRaw) {
    try {
      const parsed = new URL(checkoutContinueUrlRaw);
      const isLocalhost =
        parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalhost)) {
        return {
          error: t("dashboard.actions.continueHttps"),
          invoiceId: null,
          address: null,
          amount: null,
          recipientName: null,
          description: null,
          subaddressIndex: null,
          warnings: null,
        };
      }
    } catch {
      return {
        error: t("dashboard.actions.continueInvalid"),
        invoiceId: null,
        address: null,
        amount: null,
        recipientName: null,
        description: null,
        subaddressIndex: null,
        warnings: null,
      };
    }
  }
  const expiresAtRaw = String(formData.get("expires_at") ?? "").trim();
  const expiresDate = String(formData.get("expires_date") ?? "").trim();
  const expiresTime = String(formData.get("expires_time") ?? "").trim();
  let expiresAt: string | null = null;
  if (!expiresAtRaw && expiresTime && !expiresDate) {
    return {
      error: t("dashboard.actions.expiryDate"),
      invoiceId: null,
      address: null,
      amount: null,
      recipientName: null,
      description: null,
      subaddressIndex: null,
      warnings: null,
    };
  }
  if (!expiresAtRaw && expiresDate) {
    const timeValue = expiresTime || "00:00";
    expiresAt = `${expiresDate}T${timeValue}`;
  } else if (expiresAtRaw) {
    const normalized =
      expiresAtRaw.length === 10 || expiresAtRaw.endsWith("T")
        ? `${expiresAtRaw.replace(/T$/, "")}T00:00`
        : expiresAtRaw;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return {
        error: t("dashboard.actions.expiryInvalid"),
        invoiceId: null,
        address: null,
        amount: null,
        recipientName: null,
        description: null,
        subaddressIndex: null,
        warnings: null,
      };
    }
    expiresAt = parsed.toISOString();
  }
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return {
      error: t("dashboard.actions.expiryPast"),
      invoiceId: null,
      address: null,
      amount: null,
      recipientName: null,
      description: null,
      subaddressIndex: null,
      warnings: null,
    };
  }

  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      error: t("dashboard.actions.noApiKey"),
      invoiceId: null,
      address: null,
      amount: null,
      recipientName: null,
      description: null,
      subaddressIndex: null,
      warnings: null,
    };
  }

  const metadata: Record<string, string> = {};
  if (recipientName) {
    metadata.recipient_name = recipientName;
  }
  if (description) {
    metadata.description = description;
  }
  const qrLogoModeRaw = String(formData.get("qr_logo_mode") ?? "").trim();
  const qrLogoDataUrl = String(formData.get("qr_logo_data_url") ?? "").trim();
  const qrLogoMode =
    qrLogoModeRaw === "account_default" ||
    qrLogoModeRaw === "monero" ||
    qrLogoModeRaw === "none" ||
    qrLogoModeRaw === "custom"
      ? qrLogoModeRaw
      : "account_default";
  const qrPayload =
    qrLogoMode === "account_default"
      ? null
      : qrLogoMode === "custom"
        ? qrLogoDataUrl
          ? { logo: "custom", logo_data_url: qrLogoDataUrl }
          : null
        : { logo: qrLogoMode };

  const response = await fetch(`${apiBaseUrl}/api/core/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `ApiKey ${apiKey}`,
    },
    body: JSON.stringify({
      amount_xmr: isFiat ? null : amountRaw,
      amount_fiat: isFiat ? amountRaw : null,
      currency: isFiat ? currency : null,
      ...(confirmationTarget !== null ? { confirmation_target: confirmationTarget } : {}),
      expires_at: expiresAt,
      checkout_continue_url: checkoutContinueUrlRaw || null,
      metadata:
        Object.keys(metadata).length > 0 || qrPayload
          ? {
              ...(Object.keys(metadata).length > 0 ? metadata : {}),
              ...(qrPayload ? { qr: qrPayload } : {}),
            }
          : null,
    }),
    cache: "no-store",
  }).catch(() => new Response(null, { status: 503 }));

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = response.status === 401 ? t("dashboard.actions.authExpired") : response.status >= 500 && !detail?.code ? t("dashboard.actions.invoiceNotConfirmed") : typeof detail?.detail === "string" ? detail.detail : t("dashboard.actions.invoiceNotConfirmed");
    revalidatePath("/dashboard");
    return {
      code: typeof detail?.code === "string" ? detail.code : null,
      diagnosticId: typeof detail?.diagnostic_id === "string" ? detail.diagnostic_id : null,
      retryAfterSeconds: typeof detail?.retry_after_seconds === "number" ? detail.retry_after_seconds : Number(response.headers.get("Retry-After")) || null,
      creationAttemptId: crypto.randomUUID(),
      error: message,
      invoiceId: null,
      address: null,
      amount: null,
      recipientName: null,
      description: null,
      subaddressIndex: null,
      warnings: null,
    };
  }

  const data = await response.json().catch(() => null) as { id: string; address: string; amount_xmr: string; subaddress_index?: number | null; warnings?: string[] | null } | null;
  if (!data || typeof data.id !== "string" || typeof data.address !== "string" || typeof data.amount_xmr !== "string") {
    return { error: t("dashboard.actions.invoiceNotConfirmed"), invoiceId: null, address: null, amount: null, recipientName: null, description: null, subaddressIndex: null, warnings: null };
  }
  revalidatePath("/dashboard");
  return {
    error: null,
    invoiceId: data.id,
    address: data.address,
    amount: data.amount_xmr,
    recipientName: recipientName || null,
    description: description || null,
    subaddressIndex: data.subaddress_index ?? null,
    warnings: data.warnings ?? null,
  };
}

export async function resetApiKeyAction(
  _prevState: ApiKeyState
): Promise<ApiKeyState> {
  const { t } = await getI18n();
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return { apiKey: _prevState.apiKey, error: t("dashboard.actions.noApiKey") };
  }

  const response = await fetch(`${apiBaseUrl}/api/core/api-credentials/reset`, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reset_api_key: true }),
    cache: "no-store",
  }).catch(() => null);

  if (!response || response.status >= 500) {
    return { apiKey: _prevState.apiKey, error: t("dashboard.actions.apiKeyResetUnconfirmed") };
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? t("dashboard.actions.apiKeyResetFailed");
    return { apiKey: _prevState.apiKey, error: message };
  }

  const data = (await response.json().catch(() => null)) as { api_key?: string | null } | null;
  if (!data?.api_key) {
    return { apiKey: _prevState.apiKey, error: t("dashboard.actions.apiKeyResetUnconfirmed") };
  }
  
  // Update the cookie with the new API key
  const cookieStore = await cookies();
  cookieStore.set("xmrcheckout_api_key", data.api_key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  
  return { apiKey: data.api_key, error: null };
}

export async function resetWebhookSecretAction(
  _prevState: WebhookSecretState
): Promise<WebhookSecretState> {
  const { t } = await getI18n();
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      webhookSecret: _prevState.webhookSecret,
      error: t("dashboard.actions.noApiKey"),
    };
  }

  const response = await fetch(`${apiBaseUrl}/api/core/api-credentials/reset`, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reset_webhook_secret: true }),
    cache: "no-store",
  }).catch(() => null);

  if (!response || response.status >= 500) {
    return { webhookSecret: _prevState.webhookSecret, error: t("dashboard.actions.secretResetUnconfirmed") };
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? t("dashboard.actions.secretResetFailed");
    return { webhookSecret: _prevState.webhookSecret, error: message };
  }

  const data = (await response.json().catch(() => null)) as { webhook_secret?: string | null } | null;
  if (!data?.webhook_secret) {
    return {
      webhookSecret: _prevState.webhookSecret,
      error: t("dashboard.actions.secretResetUnconfirmed"),
    };
  }

  const cookieStore = await cookies();
  cookieStore.set("xmrcheckout_webhook_secret", data.webhook_secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return { webhookSecret: data.webhook_secret, error: null };
}

export async function updateBtcpayCheckoutStyleAction(
  _prevState: BtcpayCheckoutPreferenceState,
  formData: FormData
): Promise<BtcpayCheckoutPreferenceState> {
  const { t } = await getI18n();
  const nextStyle = String(formData.get("btcpay_checkout_style") ?? "").trim();
  if (nextStyle !== "standard" && nextStyle !== "btcpay_classic") {
    return {
      style: _prevState.style,
      error: t("dashboard.actions.invalidLayout"),
      success: null,
    };
  }

  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      style: _prevState.style,
      error: t("dashboard.actions.noApiKey"),
      success: null,
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/core/profile`, {
      method: "PATCH",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ btcpay_checkout_style: nextStyle }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await dashboardMutationError(response, t("dashboard.actions.layoutFailed"), t);
      return { style: _prevState.style, error: message, success: null };
    }

    const data = (await response.json()) as { btcpay_checkout_style?: string | null };
    const resolvedStyle =
      data.btcpay_checkout_style === "btcpay_classic" ||
      data.btcpay_checkout_style === "standard"
        ? data.btcpay_checkout_style
        : nextStyle;
    revalidatePath("/dashboard");
    return {
      style: resolvedStyle as "standard" | "btcpay_classic",
      error: null,
      success: t("dashboard.actions.preferenceSaved"),
    };
  } catch {
    return { style: _prevState.style, error: t("dashboard.actions.changeNotConfirmed"), success: null };
  }
}

export async function updateDefaultConfirmationTargetAction(
  _prevState: DefaultConfirmationTargetState,
  formData: FormData
): Promise<DefaultConfirmationTargetState> {
  const { t } = await getI18n();
  const valueRaw = String(formData.get("default_confirmation_target") ?? "").trim();
  const parsed = Number(valueRaw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
    return {
      value: _prevState.value,
      error: t("dashboard.actions.defaultTargetRange"),
      success: null,
    };
  }

  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      value: _prevState.value,
      error: t("dashboard.actions.noApiKey"),
      success: null,
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/core/profile`, {
      method: "PATCH",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ default_confirmation_target: parsed }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await dashboardMutationError(response, t("dashboard.actions.defaultTargetFailed"), t);
      return { value: _prevState.value, error: message, success: null };
    }

    const data = (await response.json()) as { default_confirmation_target?: number | null };
    const resolvedValue =
      typeof data.default_confirmation_target === "number"
        ? data.default_confirmation_target
        : parsed;
    revalidatePath("/dashboard");
    return { value: resolvedValue, error: null, success: t("dashboard.actions.defaultUpdated") };
  } catch {
    return { value: _prevState.value, error: t("dashboard.actions.changeNotConfirmed"), success: null };
  }
}

export async function updateDefaultQrLogoAction(
  _prevState: DefaultQrLogoState,
  formData: FormData
): Promise<DefaultQrLogoState> {
  const { t } = await getI18n();
  const logo = String(formData.get("default_qr_logo") ?? "").trim();
  const logoDataUrlRaw = String(formData.get("default_qr_logo_data_url") ?? "").trim();
  const normalizedLogo =
    logo === "none" || logo === "custom" || logo === "monero" ? logo : null;
  if (!normalizedLogo) {
    return {
      logo: _prevState.logo,
      logoDataUrl: _prevState.logoDataUrl,
      error: t("dashboard.actions.invalidQrMode"),
      success: null,
    };
  }

  const logoDataUrl =
    normalizedLogo === "custom" ? (logoDataUrlRaw ? logoDataUrlRaw : null) : null;
  if (normalizedLogo === "custom" && !logoDataUrl) {
    return {
      logo: _prevState.logo,
      logoDataUrl: _prevState.logoDataUrl,
      error: t("dashboard.actions.uploadLogo"),
      success: null,
    };
  }

  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      logo: _prevState.logo,
      logoDataUrl: _prevState.logoDataUrl,
      error: t("dashboard.actions.noApiKey"),
      success: null,
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/core/profile`, {
      method: "PATCH",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        default_qr_logo: normalizedLogo,
        default_qr_logo_data_url: logoDataUrl,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await dashboardMutationError(response, t("dashboard.actions.qrFailed"), t);
      return {
        logo: _prevState.logo,
        logoDataUrl: _prevState.logoDataUrl,
        error: message,
        success: null,
      };
    }

    const data = (await response.json()) as {
      default_qr_logo?: string | null;
      default_qr_logo_data_url?: string | null;
    };
    const resolvedLogo =
      data.default_qr_logo === "none" ||
      data.default_qr_logo === "custom" ||
      data.default_qr_logo === "monero"
        ? data.default_qr_logo
        : normalizedLogo;
    const resolvedDataUrl =
      resolvedLogo === "custom" ? data.default_qr_logo_data_url ?? logoDataUrl : null;
    revalidatePath("/dashboard");
    return {
      logo: resolvedLogo as "monero" | "none" | "custom",
      logoDataUrl: resolvedDataUrl ?? null,
      error: null,
      success: t("dashboard.actions.qrSaved"),
    };
  } catch {
    return { logo: _prevState.logo, logoDataUrl: _prevState.logoDataUrl, error: t("dashboard.actions.changeNotConfirmed"), success: null };
  }
}

export async function createWebhookAction(
  _prevState: WebhookFormState,
  formData: FormData
): Promise<WebhookFormState> {
  const { t } = await getI18n();
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return { error: t("dashboard.actions.noApiKey"), success: null };
  }

  const defaultUrl = String(formData.get("default_url") ?? "").trim();
  const events: string[] = [];
  const eventUrls: Record<string, string> = {};

  webhookEventKeys.forEach(({ event, key }) => {
    const enabled = formData.get(`event_${key}`) === "on";
    const override = String(formData.get(`event_url_${key}`) ?? "").trim();
    if (enabled || override) {
      events.push(event);
    }
    if (override) {
      eventUrls[event] = override;
    }
  });

  if (events.length === 0) {
    return { error: t("dashboard.actions.selectEvent"), success: null };
  }

  if (!defaultUrl) {
    const missing = events.filter((event) => !eventUrls[event]);
    if (missing.length > 0) {
      return {
        error: t("dashboard.actions.needUrl"),
        success: null,
      };
    }
  }

  const payload: {
    url?: string;
    events?: string[];
    event_urls?: Record<string, string>;
  } = {
    events,
  };

  if (defaultUrl) {
    payload.url = defaultUrl;
  }

  if (Object.keys(eventUrls).length > 0) {
    payload.event_urls = eventUrls;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/core/webhooks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${apiKey}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await dashboardMutationError(response, t("dashboard.actions.webhookCreateFailed"), t);
      return { error: message, success: null };
    }

    revalidatePath("/dashboard");
    return { error: null, success: t("dashboard.actions.webhookSaved") };
  } catch {
    return { error: t("dashboard.actions.changeNotConfirmed"), success: null };
  }
}

export async function deleteWebhookAction(
  _prevState: WebhookFormState,
  formData: FormData
): Promise<WebhookFormState> {
  const { t } = await getI18n();
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return { error: t("dashboard.actions.noApiKey"), success: null };
  }

  const webhookId = String(formData.get("webhook_id") ?? "").trim();
  if (!webhookId) {
    return { error: t("dashboard.actions.webhookIdMissing"), success: null };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/core/webhooks/${webhookId}`, {
      method: "DELETE",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await dashboardMutationError(response, t("dashboard.actions.webhookRemoveFailed"), t);
      return { error: message, success: null };
    }

    revalidatePath("/dashboard");
    return { error: null, success: t("dashboard.actions.webhookRemoved") };
  } catch {
    return { error: t("dashboard.actions.changeNotConfirmed"), success: null };
  }
}

export async function archiveInvoiceAction(
  _prevState: ArchiveInvoiceState,
  formData: FormData
): Promise<ArchiveInvoiceState> {
  const { t } = await getI18n();
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      error: t("dashboard.actions.noApiKey"),
      success: null,
      archivedId: null,
    };
  }

  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  if (!invoiceId) {
    return { error: t("dashboard.actions.invoiceIdMissing"), success: null, archivedId: null };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/core/invoices/${invoiceId}`, {
      method: "DELETE",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await dashboardMutationError(response, t("dashboard.actions.archiveFailed"), t);
      return { error: message, success: null, archivedId: null };
    }

    revalidatePath("/dashboard");
    return { error: null, success: t("dashboard.actions.archived"), archivedId: invoiceId };
  } catch {
    return { error: t("dashboard.actions.changeNotConfirmed"), success: null, archivedId: null };
  }
}

export async function loadInvoiceTransfersAction(
  invoiceId: string,
): Promise<InvoiceTransfersState> {
  const { t } = await getI18n();
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return { transfers: [], error: t("dashboard.actions.noApiKey") };
  }
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/core/invoices/${encodeURIComponent(invoiceId)}/transfers`,
      {
        headers: { Authorization: `ApiKey ${apiKey}` },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return { transfers: [], error: response.status === 401 ? t("dashboard.actions.authExpired") : t("transactions.loadFailed") };
    }
    return {
      transfers: (await response.json()) as InvoiceTransfersState["transfers"],
      error: null,
    };
  } catch {
    return { transfers: [], error: t("transactions.loadFailed") };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.set("xmrcheckout_api_key", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  cookieStore.set("xmrcheckout_webhook_secret", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  redirect("/");
}

export async function redeliverWebhookDeliveryAction(
  _prevState: WebhookRedeliverState,
  formData: FormData
): Promise<WebhookRedeliverState> {
  const { t } = await getI18n();
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return { error: t("dashboard.actions.noApiKey"), success: null };
  }

  const deliveryId = String(formData.get("delivery_id") ?? "").trim();
  if (!deliveryId) {
    return { error: t("dashboard.actions.deliveryIdMissing"), success: null };
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/api/core/webhooks/deliveries/${encodeURIComponent(deliveryId)}/redeliver`,
      {
        method: "POST",
        headers: { Authorization: `ApiKey ${apiKey}` },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const message = await dashboardMutationError(response, t("dashboard.actions.redeliverFailed"), t);
      return { error: message, success: null };
    }

    revalidatePath("/dashboard");
    return { error: null, success: t("dashboard.actions.redeliveryQueued") };
  } catch {
    return { error: t("dashboard.actions.changeNotConfirmed"), success: null };
  }
}
