import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto min-h-[60vh] max-w-2xl px-6 py-16 text-ink">
    <h1 className="font-sans text-3xl font-semibold">Page not found</h1>
    <p className="mt-4">Check the link or return to the homepage.</p>
    <Link className="mt-6 inline-flex min-h-11 items-center rounded-full bg-ink px-6 py-3 text-cream" href="/">Return home</Link>
  </main>;
}
