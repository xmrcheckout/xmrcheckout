"use client";

export default function BtcpayModalCloseButton() {
  const handleClick = () => {
    if (typeof window === "undefined" || !window.parent) {
      return;
    }
    window.parent.postMessage("close", "*");
  };

  return (
    <button
      className="rounded-full border border-stroke bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:bg-white"
      type="button"
      onClick={handleClick}
    >
      Close
    </button>
  );
}
