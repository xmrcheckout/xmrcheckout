"use client";

import { useId, useState } from "react";

const steps = [
  { title: "Create invoice", role: "Merchant", detail: "Set the amount in XMR and choose a confirmation target. Share the customer checkout page, or connect it to your store.", note: "An invoice describes a payment. Your wallet stays under your control.", x: 65, y: 19 },
  { title: "Open checkout", role: "Customer", detail: "Review the exact XMR amount and merchant address. Scan the QR code or open a Monero wallet from the checkout page. Network fees are separate.", note: "The customer chooses when to send from their own wallet.", x: 9, y: 36 },
  { title: "Pay merchant", role: "Customer → merchant wallet", detail: "The customer sends XMR directly to the merchant’s wallet. XMR Checkout does not receive or forward the funds.", note: "The payment path goes directly from one wallet to the other.", x: 50, y: 57 },
  { title: "Payment detected", role: "XMR Checkout · view-only", detail: "View-only observation identifies the incoming payment. Checkout displays confirmation progress while the merchant’s target is awaited.", note: "No further payment is requested while waiting for confirmations.", x: 35, y: 72 },
  { title: "Target reached", role: "Merchant", detail: "When the required confirmation count is reached, the invoice becomes confirmed. The customer and merchant can see the updated status.", note: "Confirmation time varies. An invoice target does not override wallet unlock rules.", x: 91, y: 55 },
  { title: "Store notified", role: "Store · optional integration", detail: "A configured webhook reports the invoice update to your store. Your integration decides how to update the order.", note: "Notifications require integration and can also report earlier invoice updates.", x: 93, y: 85 },
];

export function InvoiceJourney() {
  const [active, setActive] = useState(0);
  const id = useId();
  const step = steps[active];
  const select = (index: number) => setActive(index);

  return (
    <div className="checkout-console invoice-journey" aria-labelledby={`${id}-title`}>
      <div className="console-topbar"><h2 id={`${id}-title`}>Example invoice journey — simulated</h2></div>
      <div className="journey-scene" data-step={active + 1}>
        <svg viewBox="0 0 600 390" role="img" aria-labelledby={`${id}-art-title`}>
          <title id={`${id}-art-title`}>A customer pays the merchant’s wallet directly. XMR Checkout observes the payment and sends invoice updates to the connected store.</title>
          <defs>
            <linearGradient id={`${id}-ground`} x2="0" y2="1"><stop stopColor="#f1e5d2" stopOpacity="0"/><stop offset="1" stopColor="#e8d8bf"/></linearGradient>
            <linearGradient id={`${id}-screen`} x2="1" y2="1"><stop stopColor="#323c49"/><stop offset="1" stopColor="#101217"/></linearGradient>
            <linearGradient id={`${id}-shirt`} x2="1" y2="1"><stop stopColor="#829b87"/><stop offset="1" stopColor="#466453"/></linearGradient>
            <linearGradient id={`${id}-wall`} x2="1" y2="1"><stop stopColor="#fffaf2"/><stop offset="1" stopColor="#e5cfaf"/></linearGradient>
            <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="m1 1 7 4-7 4" fill="none" stroke="context-stroke" strokeWidth="2"/></marker>
          </defs>
          <ellipse cx="300" cy="217" rx="271" ry="149" fill={`url(#${id}-ground)`}/>
          <g fill="none" stroke="#d8c7ad" strokeWidth="1" opacity=".5"><path d="m35 239 260-142 266 142-260 139Z"/><path d="m102 276 260-142M170 314l260-143M99 204l267 147M163 168l267 147"/></g>
          {/* Information paths are distinct from the direct wallet payment. */}
          <g fill="none" stroke="#5d7a6a" strokeWidth="2" strokeDasharray="5 6" markerEnd={`url(#${id}-arrow)`}>
            <path className="journey-route journey-route-invoice" d="M405 92C305 20 201 28 128 100"/>
            <path className="journey-route journey-route-observe" d="M449 192Q415 253 322 275"/>
            <path className="journey-route journey-route-store" d="M317 290Q367 344 437 324"/>
          </g>
          <text x="264" y="43" className="journey-art-caption" textAnchor="middle">Invoice details</text>
          {/* Customer and phone */}
          <g className="journey-actor journey-customer">
            <ellipse cx="117" cy="256" rx="70" ry="17" fill="#101217" opacity=".08"/>
            <path d="m76 198 25 1-6 48-17 0Z" fill="#28333b"/><path d="m104 198 25-1 7 50-18 1Z" fill="#394751"/>
            <path d="m77 244 19 0 0 10-32 0q-3-7 13-10M117 245h19l12 8q2 5-30 3Z" fill="#101217"/>
            <path d="M71 138q28-22 54 0l14 65q-35 15-71-2Z" fill={`url(#${id}-shirt)`}/>
            <path d="m88 129 0-15h21v17q-10 10-21-2" fill="#bd8765"/>
            <ellipse cx="98" cy="100" rx="23" ry="28" fill="#dba781"/>
            <path d="M75 103q-13-34 17-36 35-5 31 31l-9-14q-17 10-37 3Z" fill="#332b28"/>
            <path d="m77 145-9 32q-2 8 8 12l46-11-3-12-34 4 7-24" fill="#dba781"/>
            <path d="m119 142 21 21 18-14 8 10-24 26q-6 4-12-3l-23-21" fill="#c18c69"/>
            <g transform="translate(142 109) rotate(9)">
              <rect width="48" height="77" rx="8" fill="#101217"/>
              <rect x="4" y="7" width="40" height="61" rx="4" fill="#fffaf2"/>
              <rect x="15" y="3" width="18" height="3" rx="2" fill="#59616a"/>
              <path d="M12 20h24M12 25h17" stroke="#c0733f" strokeWidth="3"/>
              <rect x="12" y="34" width="24" height="20" rx="3" fill="#f1e5d2"/>
              <path d="m18 44 4 4 9-9" fill="none" stroke="#5d7a6a" strokeWidth="3"/>
              <circle cx="24" cy="72" r="2" fill="#89939b"/>
            </g>
          </g>
          <text x="103" y="286" className="journey-art-label" textAnchor="middle">Customer</text>
          {/* Merchant workstation, portrait, and wallet */}
          <g className="journey-actor journey-merchant">
            <ellipse cx="455" cy="206" rx="97" ry="18" fill="#101217" opacity=".08"/>
            <path d="m374 171 140-8 37 20-147 13Z" fill="#dbc3a2"/><path d="m404 196 147-13v8l-147 14-30-24v-10Z" fill="#b99771"/>
            <path d="m392 192 0 36M536 194v25" stroke="#8a735b" strokeWidth="6"/>
            <path d="M475 109q25-11 43 4l12 59-68 4Z" fill="#c0733f"/>
            <path d="M490 106V91h17v18" fill="#b78060"/>
            <ellipse cx="498" cy="78" rx="21" ry="26" fill="#dba781"/>
            <path d="M477 80q-11-39 24-30 25-1 19 31l-10-18-31 2Z" fill="#383330"/>
            <path d="m512 118 8 33-39 10" fill="none" stroke="#dba781" strokeWidth="12" strokeLinecap="round"/>
            <path d="m433 157-4 21 27 0-7-22" fill="#646a6d"/>
            <rect x="378" y="88" width="102" height="73" rx="6" fill="#101217"/>
            <rect x="383" y="93" width="92" height="61" rx="3" fill={`url(#${id}-screen)`}/>
            <circle cx="394" cy="104" r="3" fill="#f26822"/><path d="M403 104h32" stroke="#f8f2e9" strokeWidth="3"/>
            <rect x="391" y="116" width="76" height="12" rx="3" fill="#394a44"/>
            <path d="m397 122 3 3 5-6" stroke="#b3ccb8" strokeWidth="2" fill="none"/>
            <path d="M412 122h44M392 138h27M434 138h29" stroke="#a9b2b8" strokeWidth="3"/>
            <g transform="translate(448 184)">
              <path d="M0-12q0-6 7-7l41-5v14" fill="#a85e31"/>
              <rect width="55" height="34" y="-14" rx="6" fill="#c0733f"/>
              <path d="M2-8h48" stroke="#e5b18a"/>
              <rect x="37" y="-5" width="21" height="15" rx="4" fill="#8c4c2b"/><circle cx="44" cy="2" r="2" fill="#f8f2e9"/>
            </g>
          </g>
          <text x="446" y="69" className="journey-art-label" textAnchor="middle">Merchant</text>
          <text x="478" y="231" className="journey-art-caption" textAnchor="middle">Merchant’s wallet</text>
          <path className="journey-route journey-route-payment" d="M191 174Q305 206 442 190" fill="none" stroke="#b65b25" strokeWidth="3" markerEnd={`url(#${id}-arrow)`}/>
          <rect x="221" y="161" width="151" height="25" rx="12" fill="#f8f2e9"/><text x="296" y="178" className="journey-art-caption" textAnchor="middle">XMR · directly to wallet</text>
          {/* View-only observation station */}
          <g className="journey-actor journey-observer" transform="translate(226 254)">
            <ellipse cx="62" cy="62" rx="69" ry="12" fill="#101217" opacity=".07"/>
            <rect width="154" height="58" rx="14" fill="#101217"/>
            <circle cx="25" cy="27" r="13" fill="#f26822"/>
            <path d="m16 29 0-9 9 9 9-9v14h-7v-6l-2 2-2-2v6h-7" fill="#fff"/>
            <text x="47" y="25" fill="#f8f2e9" fontSize="11" fontWeight="600">XMR Checkout</text>
            <text x="47" y="42" fill="#c7d5cb" fontSize="10">View-only access</text>
          </g>
          {/* Storefront */}
          <g className="journey-actor journey-store" transform="translate(435 264)">
            <ellipse cx="49" cy="98" rx="69" ry="12" fill="#101217" opacity=".08"/>
            <path d="m0 20 87 0 19 12v65l-106 0Z" fill={`url(#${id}-wall)`}/><path d="m87 20 19 12v65l-19-9Z" fill="#ceb898"/>
            <rect x="8" y="48" width="40" height="36" rx="2" fill="#34443e"/><path d="M28 49v34M9 67h38" stroke="#b3c4b5" strokeWidth="2"/>
            <rect x="56" y="45" width="24" height="52" rx="2" fill="#6c8272"/><rect x="60" y="50" width="16" height="26" fill="#d9e2d6"/><circle cx="75" cy="83" r="2" fill="#f1e5d2"/>
            <path d="m-6 17 94 0 8 23H-11Z" fill="#f8f2e9"/>
            <path d="m-6 17 17 0-2 23h-20ZM28 17h17l2 23H27ZM62 17h17l8 23H67Z" fill="#c0733f"/>
            <path d="M-11 40q9 10 19 0 10 10 19 0 10 10 20 0 10 10 20 0 10 10 20 0l9 0" fill="none" stroke="#a98c69" strokeWidth="2"/>
            <rect x="7" y="-3" width="72" height="18" rx="3" fill="#101217"/><text x="43" y="10" textAnchor="middle" fill="#f8f2e9" fontSize="10" letterSpacing="2">STORE</text>
            <rect x="-20" y="65" width="41" height="27" rx="4" fill="#fffaf2" stroke="#cbb89c"/><path d="m-12 79 5 5 8-11M6 76h9M6 82h9" fill="none" stroke="#5d7a6a" strokeWidth="2"/>
          </g>
          <text x="381" y="365" className="journey-art-caption" textAnchor="middle">Invoice updates</text>
        </svg>
        {steps.map((item, index) => (
          <button key={item.title} type="button" className="journey-hotspot" style={{ left: `${item.x}%`, top: `${item.y}%` }} aria-label={`Step ${index + 1}: ${item.title}`} aria-pressed={active === index} aria-controls={`${id}-detail`} onMouseEnter={() => select(index)} onFocus={() => select(index)} onClick={() => select(index)}>{index + 1}</button>
        ))}
      </div>
      <div className="journey-explore">Explore each step <span>Hover, focus, or tap</span></div>
      <div className="journey-steps" aria-label="Invoice journey steps">
        {steps.map((item, index) => <button key={item.title} type="button" aria-pressed={active === index} aria-controls={`${id}-detail`} onMouseEnter={() => select(index)} onFocus={() => select(index)} onClick={() => select(index)}><span>{String(index + 1).padStart(2, "0")}</span>{item.title}</button>)}
      </div>
      <div className="journey-detail" id={`${id}-detail`} role="region" aria-label="Selected step explanation" aria-live="polite" aria-atomic="true">
        <p className="journey-detail-role">{String(active + 1).padStart(2, "0")} / 06 <span>{step.role}</span></p>
        <h3>{step.title}</h3><p>{step.detail}</p><p className="journey-detail-note">{step.note}</p>
      </div>
      <p className="home-journey-note">Illustrative steps only. No payment is requested. Store notifications require integration.</p>
    </div>
  );
}
