import { useId } from "react";

import { JourneyIcon, MoneroCoin } from "./invoice-journey-icons";

const artDescription = "A customer pays your wallet directly. XMR Checkout only watches with view-only access, cannot spend, and can optionally update your store.";
const payColor = "#b65b25";
const infoColor = "#4d6a5a";
const warmTint = "#e6a36f";

export function InvoiceJourney() {
  const id = useId();

  return (
    <div className="checkout-console invoice-journey" role="region" aria-labelledby={`${id}-title`}>
      <div className="console-topbar"><h2 id={`${id}-title`}>How a payment reaches your wallet</h2></div>
      <div className="journey-scene">
        <svg className="journey-art" viewBox="0 0 400 288" role="img" aria-labelledby={`${id}-art`}>
          <title id={`${id}-art`}>{artDescription}</title>
          <defs>
            {[["pay", payColor], ["info", infoColor]].map(([kind, color]) => (
              <marker key={kind} id={`${id}-${kind}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
                <path d="M1 1l7 4-7 4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            ))}
          </defs>

          <rect x="8" y="16" width="106" height="96" rx="12" fill="#fffaf2" stroke="#10121730" />
          <JourneyIcon name="phone" x={39} y={22} size={44} />
          <text className="journey-text-strong" x="61" y="94" textAnchor="middle">Customer</text>

          <rect x="286" y="16" width="106" height="96" rx="12" fill="#fffaf2" stroke="#c0733f" strokeWidth="1.5" />
          <JourneyIcon name="wallet" x={317} y={22} size={44} tint={warmTint} />
          <text className="journey-text-strong" x="339" y="94" textAnchor="middle">Your wallet</text>

          {/* The only solid line: the payment goes directly to the merchant's wallet. */}
          <path d="M116 64H282" fill="none" stroke={payColor} strokeWidth="3.5" markerEnd={`url(#${id}-pay)`} />
          <text className="journey-text-strong" x="158" y="38" textAnchor="middle">XMR</text>

          <path d="M158 192V88" fill="none" stroke={infoColor} strokeWidth="2" strokeDasharray="5 5" markerEnd={`url(#${id}-info)`} />
          <text className="journey-text-strong" x="170" y="135">Watches,</text>
          <text className="journey-text-sub" x="170" y="154">can’t spend</text>
          <MoneroCoin cx={158} cy={64} r={16} className="journey-coin" />

          <rect x="74" y="192" width="168" height="72" rx="14" fill="#101217" />
          <image href="/logo.png" x="80" y="212" width="32" height="32" preserveAspectRatio="xMidYMid meet" />
          <text className="journey-text-card" x="117" y="233">XMR Checkout</text>

          <path d="M242 228H282" fill="none" stroke={infoColor} strokeWidth="2" strokeDasharray="5 5" markerEnd={`url(#${id}-info)`} />
          <rect x="286" y="180" width="106" height="96" rx="12" fill="#fffaf2" stroke="#8a735b" strokeWidth="1.25" strokeDasharray="4 4" />
          <JourneyIcon name="storefront" x={319} y={183} size={40} tint={warmTint} />
          <text className="journey-text-strong" x="339" y="243" textAnchor="middle">Your store</text>
          <text className="journey-text-sub" x="339" y="261" textAnchor="middle">Optional</text>
        </svg>
      </div>
      <p className="journey-caption">Confirmation time varies. An invoice target does not override wallet unlock rules.</p>
    </div>
  );
}
