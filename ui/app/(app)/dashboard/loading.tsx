import { getI18n } from "../../../lib/i18n/server";

export default async function DashboardLoading() {
  const { t } = await getI18n();
  return <main id="main-content" tabIndex={-1} className="px-[6vw] py-8 text-ink" role="status">{t("dashboard.page.loading")}</main>;
}
