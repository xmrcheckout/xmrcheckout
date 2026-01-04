import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Welcome",
};

export default async function WelcomePage() {
  const session = (await cookies()).get("xmrcheckout_session")?.value;
  if (!session) {
    redirect("/?login=1");
  }
  redirect("/dashboard");
}
