"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";

export type InvoiceState = {
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

const tourNoopMessage = "Tour mode only: no changes are saved.";

export async function createInvoiceTourAction(
  _prevState: InvoiceState,
  _formData: FormData
): Promise<InvoiceState> {
  return {
    error: tourNoopMessage,
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
  const archivedId = String(formData.get("invoice_id") ?? "").trim() || null;
  return {
    error: null,
    success: tourNoopMessage,
    archivedId,
  };
}

export async function createWebhookTourAction(
  _prevState: WebhookFormState,
  _formData: FormData
): Promise<WebhookFormState> {
  return { error: null, success: tourNoopMessage };
}

export async function deleteWebhookTourAction(
  _prevState: WebhookFormState,
  _formData: FormData
): Promise<WebhookFormState> {
  return { error: null, success: tourNoopMessage };
}

export async function redeliverWebhookDeliveryTourAction(
  _prevState: WebhookRedeliverState,
  _formData: FormData
): Promise<WebhookRedeliverState> {
  return { error: null, success: tourNoopMessage };
}

const webhookEventKeys = [
  { event: "invoice.created", key: "invoice_created" },
  { event: "invoice.payment_detected", key: "invoice_payment_detected" },
  { event: "invoice.confirmed", key: "invoice_confirmed" },
  { event: "invoice.expired", key: "invoice_expired" },
] as const;

export async function createInvoiceAction(
  _prevState: InvoiceState,
  formData: FormData
): Promise<InvoiceState> {
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
        error: "Confirmation target must be between 0 and 10.",
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
      error: isFiat ? "Enter a valid fiat amount." : "Enter a valid XMR amount.",
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
      error: "Currency is required when using a fiat amount.",
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
          error: "Continue URL must use https (http is allowed for localhost).",
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
        error: "Continue URL must be a valid URL.",
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
      error: "Expiry date must include a date.",
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
        error: "Expiry date must be a valid date and time.",
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

  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      error: "API key not found. Please sign in again.",
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
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? "Unable to create invoice.";
    return {
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

  const data = (await response.json()) as {
    id: string;
    address: string;
    subaddress_index?: number | null;
    amount_xmr: string;
    warnings?: string[] | null;
  };
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
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return { apiKey: _prevState.apiKey, error: "API key not found. Please sign in again." };
  }

  const response = await fetch(`${apiBaseUrl}/api/core/api-credentials/reset`, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reset_api_key: true }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? "Unable to reset API key.";
    return { apiKey: _prevState.apiKey, error: message };
  }

  const data = (await response.json()) as { api_key?: string | null };
  if (!data.api_key) {
    return { apiKey: _prevState.apiKey, error: "API key reset did not return a key." };
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
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      webhookSecret: _prevState.webhookSecret,
      error: "API key not found. Please sign in again.",
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
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? "Unable to reset webhook secret.";
    return { webhookSecret: _prevState.webhookSecret, error: message };
  }

  const data = (await response.json()) as { webhook_secret?: string | null };
  if (!data.webhook_secret) {
    return {
      webhookSecret: _prevState.webhookSecret,
      error: "Webhook secret reset did not return a secret.",
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
  const nextStyle = String(formData.get("btcpay_checkout_style") ?? "").trim();
  if (nextStyle !== "standard" && nextStyle !== "btcpay_classic") {
    return {
      style: _prevState.style,
      error: "Select a valid BTCPay checkout layout.",
      success: null,
    };
  }

  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      style: _prevState.style,
      error: "API key not found. Please sign in again.",
      success: null,
    };
  }

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
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? "Unable to update BTCPay preference.";
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
    success: "Preference saved.",
  };
}

export async function updateDefaultConfirmationTargetAction(
  _prevState: DefaultConfirmationTargetState,
  formData: FormData
): Promise<DefaultConfirmationTargetState> {
  const valueRaw = String(formData.get("default_confirmation_target") ?? "").trim();
  const parsed = Number(valueRaw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
    return {
      value: _prevState.value,
      error: "Default confirmation target must be an integer between 0 and 10.",
      success: null,
    };
  }

  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      value: _prevState.value,
      error: "API key not found. Please sign in again.",
      success: null,
    };
  }

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
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? "Unable to update the default confirmation target.";
    return { value: _prevState.value, error: message, success: null };
  }

  const data = (await response.json()) as { default_confirmation_target?: number | null };
  const resolvedValue =
    typeof data.default_confirmation_target === "number"
      ? data.default_confirmation_target
      : parsed;
  revalidatePath("/dashboard");
  return { value: resolvedValue, error: null, success: "Default updated." };
}

export async function updateDefaultQrLogoAction(
  _prevState: DefaultQrLogoState,
  formData: FormData
): Promise<DefaultQrLogoState> {
  const logo = String(formData.get("default_qr_logo") ?? "").trim();
  const logoDataUrlRaw = String(formData.get("default_qr_logo_data_url") ?? "").trim();
  const normalizedLogo =
    logo === "none" || logo === "custom" || logo === "monero" ? logo : null;
  if (!normalizedLogo) {
    return {
      logo: _prevState.logo,
      logoDataUrl: _prevState.logoDataUrl,
      error: "Select a valid QR logo mode.",
      success: null,
    };
  }

  const logoDataUrl =
    normalizedLogo === "custom" ? (logoDataUrlRaw ? logoDataUrlRaw : null) : null;
  if (normalizedLogo === "custom" && !logoDataUrl) {
    return {
      logo: _prevState.logo,
      logoDataUrl: _prevState.logoDataUrl,
      error: "Upload a logo image for custom mode.",
      success: null,
    };
  }

  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      logo: _prevState.logo,
      logoDataUrl: _prevState.logoDataUrl,
      error: "API key not found. Please sign in again.",
      success: null,
    };
  }

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
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? "Unable to update QR settings.";
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
    success: "QR default saved.",
  };
}

export async function createWebhookAction(
  _prevState: WebhookFormState,
  formData: FormData
): Promise<WebhookFormState> {
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return { error: "API key not found. Please sign in again.", success: null };
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
    return { error: "Select at least one invoice event.", success: null };
  }

  if (!defaultUrl) {
    const missing = events.filter((event) => !eventUrls[event]);
    if (missing.length > 0) {
      return {
        error: "Provide a default URL or an override URL for each selected event.",
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
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? "Unable to create webhook.";
    return { error: message, success: null };
  }

  revalidatePath("/dashboard");
  return { error: null, success: "Webhook saved." };
}

export async function deleteWebhookAction(
  _prevState: WebhookFormState,
  formData: FormData
): Promise<WebhookFormState> {
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return { error: "API key not found. Please sign in again.", success: null };
  }

  const webhookId = String(formData.get("webhook_id") ?? "").trim();
  if (!webhookId) {
    return { error: "Webhook id missing.", success: null };
  }

  const response = await fetch(`${apiBaseUrl}/api/core/webhooks/${webhookId}`, {
    method: "DELETE",
    headers: {
      Authorization: `ApiKey ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? "Unable to remove webhook.";
    return { error: message, success: null };
  }

  revalidatePath("/dashboard");
  return { error: null, success: "Webhook removed." };
}

export async function archiveInvoiceAction(
  _prevState: ArchiveInvoiceState,
  formData: FormData
): Promise<ArchiveInvoiceState> {
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return {
      error: "API key not found. Please sign in again.",
      success: null,
      archivedId: null,
    };
  }

  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  if (!invoiceId) {
    return { error: "Invoice id missing.", success: null, archivedId: null };
  }

  const response = await fetch(`${apiBaseUrl}/api/core/invoices/${invoiceId}`, {
    method: "DELETE",
    headers: {
      Authorization: `ApiKey ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? "Unable to archive invoice.";
    return { error: message, success: null, archivedId: null };
  }

  revalidatePath("/dashboard");
  return { error: null, success: "Invoice archived until expiry.", archivedId: invoiceId };
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
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) {
    return { error: "API key not found. Please sign in again.", success: null };
  }

  const deliveryId = String(formData.get("delivery_id") ?? "").trim();
  if (!deliveryId) {
    return { error: "Delivery id missing.", success: null };
  }

  const response = await fetch(
    `${apiBaseUrl}/api/core/webhooks/deliveries/${encodeURIComponent(deliveryId)}/redeliver`,
    {
      method: "POST",
      headers: { Authorization: `ApiKey ${apiKey}` },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message = detail?.detail ?? "Unable to redeliver the webhook.";
    return { error: message, success: null };
  }

  revalidatePath("/dashboard");
  return { error: null, success: "Redelivery queued." };
}
