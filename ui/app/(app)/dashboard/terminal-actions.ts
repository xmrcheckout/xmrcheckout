"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type TerminalState = { error: string; success: string; url: string };
const apiBase = () => process.env.API_BASE_URL ?? "http://localhost:8000";

async function detail(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.detail) && typeof data.detail[0]?.msg === "string") return data.detail[0].msg.replace(/^Value error, /, "");
  return fallback;
}

export async function saveTerminal(_state: TerminalState, form: FormData): Promise<TerminalState> {
  const apiKey = (await cookies()).get("xmrcheckout_api_key")?.value;
  if (!apiKey) return { error: "Connect before saving a terminal.", success: "", url: "" };
  const id = String(form.get("id") ?? "");
  const rotating = form.get("mode") === "rotate" && !!id;
  try {
    const response = await fetch(`${apiBase()}/api/core/terminals${id ? `/${encodeURIComponent(id)}${rotating ? "/rotate" : ""}` : ""}`, {
      method: rotating ? "POST" : id ? "PATCH" : "POST", cache: "no-store",
      headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
      body: rotating ? undefined : JSON.stringify({
        name: form.get("name"), default_currency: form.get("default_currency"),
        confirmation_target: Number(form.get("confirmation_target")),
        expiry_minutes: Number(form.get("expiry_minutes")), enabled: form.get("enabled") === "on",
      }),
    });
    if (!response.ok) return { error: await detail(response, "Check the terminal settings."), success: "", url: "" };
    const data = await response.json();
    revalidatePath("/dashboard");
    if (data.url) return { error: "", success: rotating ? "New link created. The previous link no longer works." : "Terminal created.", url: data.url };
    return { error: "", success: "Terminal saved.", url: "" };
  } catch {
    return { error: "Could not confirm saving. Check the terminal list before trying again.", success: "", url: "" };
  }
}
