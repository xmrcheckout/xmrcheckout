import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getI18n } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.welcome") };
}

export default async function WelcomePage() {
  const session = (await cookies()).get("xmrcheckout_session")?.value;
  if (!session) {
    redirect("/?login=1");
  }
  redirect("/dashboard");
}
