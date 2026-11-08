import { useId } from "react";

import { JourneyIcon, MoneroCoin } from "./invoice-journey-icons";
import type { Translate } from "../lib/i18n/translate";

const payColor = "#b65b25";
const infoColor = "#4d6a5a";
const warmTint = "#e6a36f";

export function InvoiceJourney({ t }: { t: Translate }) {
  const id = useId();

  return (
    <div className="checkout-console invoice-journey" role="region" aria-labelledby={`${id}-title`}>
      <div className="console-topbar"><h2 id={`${id}-title`}>{t("home.journey.title")}</h2></div>
      <div className="journey-scene">
        <svg className="journey-art" viewBox="0 0 400 288" role="img" aria-labelledby={`${id}-art`}>
          <title id={`${id}-art`}>{t("home.journey.description")}</title>
          <defs>
            {[["pay", payColor], ["info", infoColor]].map(([kind, color]) => (
              <marker key={kind} id={`${id}-${kind}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
                <path d="M1 1l7 4-7 4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            ))}
          </defs>

          <rect x="8" y="16" width="106" height="96" rx="12" fill="#fffaf2" stroke="#10121730" />
          <JourneyIcon name="phone" x={39} y={22} size={44} />
          <text className="journey-text-strong" x="61" y="94" textAnchor="middle">{t("home.journey.customer")}</text>

          <rect x="286" y="16" width="106" height="96" rx="12" fill="#fffaf2" stroke="#c0733f" strokeWidth="1.5" />
          <JourneyIcon name="wallet" x={317} y={22} size={44} tint={warmTint} />
          <text className="journey-text-strong" x="339" y="94" textAnchor="middle">{t("home.journey.yourWallet")}</text>

          {/* The only solid line: the payment goes directly to the merchant's wallet. */}
          <path d="M116 64H282" fill="none" stroke={payColor} strokeWidth="3.5" markerEnd={`url(#${id}-pay)`} />
          <text className="journey-text-strong" x="158" y="38" textAnchor="middle">XMR</text>

          <path d="M158 184V88" fill="none" stroke={infoColor} strokeWidth="2" strokeDasharray="5 5" markerEnd={`url(#${id}-info)`} />
          <text className="journey-text-strong" x="170" y="135">{t("home.journey.watches")}</text>
          <text className="journey-text-sub" x="170" y="154">{t("home.journey.cantSpend")}</text>
          <MoneroCoin cx={158} cy={64} r={16} className="journey-coin" />

          <rect x="34" y="184" width="208" height="92" rx="14" fill="#101217" />
          <image href="/logo.png" x="62" y="198" width="32" height="32" preserveAspectRatio="xMidYMid meet" />
          <text className="journey-text-card" x="100" y="220">XMR Checkout</text>
          <text className="journey-text-card-sub" x="138" y="250" textAnchor="middle">{t("home.journey.cardLine1")}</text>
          <text className="journey-text-card-sub" x="138" y="267" textAnchor="middle">{t("home.journey.cardLine2")}</text>

          <path d="M242 228H282" fill="none" stroke={infoColor} strokeWidth="2" strokeDasharray="5 5" markerEnd={`url(#${id}-info)`} />
          <rect x="286" y="180" width="106" height="96" rx="12" fill="#fffaf2" stroke="#8a735b" strokeWidth="1.25" strokeDasharray="4 4" />
          <JourneyIcon name="storefront" x={319} y={183} size={40} tint={warmTint} />
          <text className="journey-text-strong" x="339" y="243" textAnchor="middle">{t("home.journey.yourStore")}</text>
          <text className="journey-text-sub" x="339" y="261" textAnchor="middle">{t("home.journey.optional")}</text>
        </svg>
      </div>
    </div>
  );
}
