import type { Translate } from "./i18n/translate";

// A failed response cannot prove that a mutation did not take effect.
export async function dashboardMutationError(response: Response | null, fallback: string, t: Translate): Promise<string> {
  if (response?.status === 401) return t("dashboard.actions.authExpired");
  if (!response || response.status >= 500) return t("dashboard.actions.changeNotConfirmed");
  const data = await response.json().catch(() => null);
  return typeof data?.detail === "string" ? data.detail : fallback;
}
