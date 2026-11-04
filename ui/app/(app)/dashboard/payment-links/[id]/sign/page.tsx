import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { formatXmrAmount } from "../../../../../../lib/formatting";
import type { PaymentLinkData } from "../../../../../../components/payment-link-editor";
import { signXmrAmount } from "../../../../../../lib/payment-button";
import { PrintSignButton, SignQrCode } from "../../../../../../components/payment-link-sign";

export const metadata: Metadata = { title: "Printable sign", robots: { index: false, follow: false } };

const backLink = "/dashboard?tab=payment-links";

export default async function PaymentLinkSignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = (await cookies()).get("xmrcheckout_api_key")?.value;
  const loginUrl = `/?login=1&next=${encodeURIComponent(backLink)}`;
  if (!key) redirect(loginUrl);
  const base = process.env.API_BASE_URL ?? "http://localhost:8000";
  const response = await fetch(`${base}/api/core/payment-links`, { headers: { Authorization: `ApiKey ${key}` }, cache: "no-store" }).catch(() => null);
  if (response?.status === 401) redirect(loginUrl);
  const links: PaymentLinkData[] | null = response?.ok ? await response.json() : null;
  const link = links?.find(item => item.id === id);
  const back = <Link className="font-semibold underline decoration-clay underline-offset-4" href={backLink}>Back to payment links</Link>;
  if (!links || !link) {
    return <main id="main-content" tabIndex={-1} className="px-[6vw] pb-16 pt-8 text-ink">
      <h1 className="font-sans text-2xl font-semibold">Printable sign</h1>
      <p role="alert" className="mt-3">{links ? "This payment link was not found." : "Payment links are unavailable. Refresh to try again."}</p>
      <p className="mt-3">{back}</p>
    </main>;
  }
  const amount = signXmrAmount(link);
  const fixedXmr = amount ? `${formatXmrAmount(amount)} XMR` : null;
  return <main id="main-content" tabIndex={-1} className="px-[6vw] pb-16 pt-8 text-ink">
    <div className="no-print mx-auto grid max-w-2xl gap-3">
      <h1 className="font-sans text-2xl font-semibold sm:text-3xl">Printable sign</h1>
      <p className="text-ink-soft">Print this sign or save it as a PDF from the print dialog. Customers scan the QR code to open your payment link; each payment goes directly to your wallet.</p>
      {!link.enabled ? <p role="alert" className="rounded-xl border border-clay p-3">This payment link is disabled. The QR code will not work until you enable the link again.</p> : null}
      <div className="flex flex-wrap items-center gap-4"><PrintSignButton />{back}</div>
    </div>
    <article aria-label="Sign preview" className="print-sign mx-auto mt-8 grid max-w-2xl justify-items-center gap-5 rounded-2xl border border-stroke bg-white p-8 text-center">
      <Image src="/badges/monero-accepted-here.svg" alt="Monero accepted here" width={320} height={80} unoptimized className="h-auto max-w-full" />
      <h2 className="break-words font-sans text-3xl font-semibold">{link.title}</h2>
      {fixedXmr ? <p className="text-2xl font-semibold">{fixedXmr}</p> : null}
      <SignQrCode url={link.url} />
      <p className="text-xl font-semibold">Scan to pay with Monero</p>
      <p className="break-all font-mono text-sm text-ink-soft">{link.url}</p>
    </article>
  </main>;
}
