import Link from "next/link";

export default function PaymentLinkNotFound() {
  return <main id="main-content" tabIndex={-1} className="mx-auto min-h-[60vh] max-w-2xl px-6 py-16 text-ink">
    <h1 className="font-sans text-3xl font-semibold">Payment link unavailable</h1>
    <p className="mt-4">Do not send payment. Contact the merchant for a new payment link.</p>
    <Link className="mt-6 inline-flex min-h-11 items-center underline" href="/">Return home</Link>
  </main>;
}
