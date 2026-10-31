"use client";

import { useId, useState } from "react";

import { JourneyIcon, MoneroCoin } from "./invoice-journey-icons";
import StatusBadge, { type StatusTone } from "./status-badge";
import { simulationLabels } from "../lib/simulated-invoice";

type Step = {
  title: string;
  role: string;
  detail: string;
  note: string;
  status: { label: string; tone: StatusTone; confirmations: string };
};

const awaiting = { label: simulationLabels.pending, tone: "pending", confirmations: "0 of 10 confirmations" } as const;
const confirmed = { label: simulationLabels.confirmed, tone: "success", confirmations: "10 of 10 confirmations" } as const;

const steps: Step[] = [
  { title: "Create invoice", role: "Merchant", detail: "Set the amount in XMR and choose a confirmation target. Share the customer checkout page. Connecting a store is optional.", note: "An invoice describes a payment. Your wallet stays under your control.", status: awaiting },
  { title: "Open checkout", role: "Customer", detail: "Review the exact XMR amount and merchant address. Scan the QR code or open a Monero wallet from the checkout page. Network fees are separate.", note: "The customer chooses when to send from their own wallet.", status: awaiting },
  { title: "Pay merchant", role: "Customer → merchant invoice subaddress", detail: "The customer sends XMR directly to the merchant’s invoice subaddress. XMR Checkout does not receive or forward the funds.", note: "The subaddress identifies this invoice within the merchant’s wallet.", status: awaiting },
  { title: "Payment detected", role: "XMR Checkout · view-only", detail: "View-only observation identifies the incoming payment. Checkout displays confirmation progress while the merchant’s target is awaited.", note: "No further payment is requested while waiting for confirmations.", status: { label: simulationLabels.payment_detected, tone: "detected", confirmations: "3 of 10 confirmations" } },
  { title: "Target reached", role: "Merchant", detail: "When the required confirmation count is reached, the invoice becomes confirmed. The customer and merchant can see the updated status.", note: "Confirmation time varies. An invoice target does not override wallet unlock rules.", status: confirmed },
  { title: "Store notified", role: "Store · optional integration", detail: "A configured webhook reports the invoice update to your store. Your integration decides how to update the order.", note: "Notifications require integration and can also report earlier invoice updates.", status: confirmed },
];

const artDescription = "A customer pays your wallet directly. XMR Checkout only detects the payment with view-only access and can optionally notify your store.";
const payColor = "#b65b25";
const infoColor = "#4d6a5a";
const warmTint = "#e6a36f";

function Arrowheads({ prefix }: { prefix: string }) {
  return (
    <defs>
      {[["pay", payColor], ["info", infoColor]].map(([kind, color]) => (
        <marker key={kind} id={`${prefix}-${kind}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M1 1l7 4-7 4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      ))}
    </defs>
  );
}

function Badge({ step, x, y }: { step: number; x: number; y: number }) {
  return (
    <g className="journey-badge" data-on={step}>
      <circle cx={x} cy={y} r="10" />
      <text x={x} y={y + 4} textAnchor="middle">{step}</text>
    </g>
  );
}

function PaymentLine({ d, prefix }: { d: string; prefix: string }) {
  return (
    <g className="journey-route" data-on="3">
      <path d={d} fill="none" stroke={payColor} strokeWidth="3.5" markerEnd={`url(#${prefix}-pay)`} />
    </g>
  );
}

function InfoLine({ d, prefix, on }: { d: string; prefix: string; on: string }) {
  return (
    <g className="journey-route" data-on={on}>
      <path d={d} fill="none" stroke={infoColor} strokeWidth="2" strokeDasharray="5 5" markerEnd={`url(#${prefix}-info)`} />
    </g>
  );
}

function Key({ y, startX, infoX }: { y: number; startX: number; infoX: number }) {
  return (
    <g>
      <path d={`M${startX} ${y}h24`} stroke={payColor} strokeWidth="3.5" />
      <text className="journey-text-key" x={startX + 30} y={y + 4}>Payment</text>
      <path d={`M${infoX} ${y}h24`} stroke={infoColor} strokeWidth="2" strokeDasharray="5 5" />
      <text className="journey-text-key" x={infoX + 30} y={y + 4}>Information only</text>
    </g>
  );
}

function WideArt({ id }: { id: string }) {
  const prefix = `${id}-wide`;
  return (
    <svg className="journey-art journey-art-wide" viewBox="0 0 640 360" role="img" aria-labelledby={`${prefix}-title`}>
      <title id={`${prefix}-title`}>{artDescription}</title>
      <Arrowheads prefix={prefix} />

      <rect x="16" y="16" width="168" height="150" rx="14" fill="#fffaf2" stroke="#10121730" />
      <text className="journey-text-strong" x="32" y="40">Customer</text>
      <g className="journey-obj" data-on="2 3 5">
        <JourneyIcon name="phone" x={36} y={50} size={52} />
        <JourneyIcon name="qrCode" x={96} y={50} size={52} />
      </g>
      <text className="journey-text-sub" x="32" y="128">Scans and pays from</text>
      <text className="journey-text-sub" x="32" y="145">their own wallet</text>

      <rect x="432" y="16" width="192" height="328" rx="14" fill="#f1e5d2" />
      <text className="journey-text-strong" x="446" y="40">Your business</text>
      <g className="journey-obj" data-on="3 5">
        <rect x="446" y="52" width="164" height="114" rx="12" fill="#fffaf2" stroke="#c0733f" strokeWidth="1.5" />
        <JourneyIcon name="wallet" x={502} y={58} size={52} tint={warmTint} />
      </g>
      <text className="journey-text-strong" x="528" y="133" textAnchor="middle">Your wallet</text>
      <text className="journey-text-sub" x="528" y="151" textAnchor="middle">Only you can spend</text>
      <g className="journey-obj" data-on="6">
        <rect x="446" y="228" width="164" height="102" rx="12" fill="#fffaf2" stroke="#8a735b" strokeWidth="1.25" strokeDasharray="4 4" />
        <JourneyIcon name="storefront" x={502} y={232} size={52} tint={warmTint} />
      </g>
      <text className="journey-text-strong" x="528" y="301" textAnchor="middle">Your store</text>
      <text className="journey-text-sub" x="528" y="319" textAnchor="middle">Optional</text>

      <InfoLine d="M196 290H80Q72 290 72 282V170" prefix={prefix} on="2" />
      <text className="journey-text-route" x="82" y="280">Checkout page</text>

      <PaymentLine d="M186 108H442" prefix={prefix} />
      <text className="journey-text-strong" x="315" y="66" textAnchor="middle">XMR, sent directly</text>
      <text className="journey-text-sub" x="315" y="83" textAnchor="middle">to the invoice subaddress</text>

      <g className="journey-route" data-on="4">
        <circle cx="286" cy="108" r="20" fill="none" stroke={infoColor} strokeWidth="2" strokeDasharray="4 4" />
        <path d="M286 252V132" fill="none" stroke={infoColor} strokeWidth="2" strokeDasharray="5 5" markerEnd={`url(#${prefix}-info)`} />
        <circle cx="286" cy="182" r="17" fill="#fbf6ee" />
        <JourneyIcon name="eye" x={272} y={168} size={28} tint="#b3ccb8" line="#33493d" />
      </g>
      <text className="journey-text-strong" x="308" y="172">Detects only</text>
      <text className="journey-text-sub" x="308" y="189">View-only access,</text>
      <text className="journey-text-sub" x="308" y="206">cannot spend</text>
      <MoneroCoin cx={286} cy={108} r={14} className="journey-coin-wide" />

      <g className="journey-obj journey-obj-card" data-on="1 2 4 6">
        <rect x="196" y="252" width="168" height="76" rx="14" fill="#101217" />
        <image href="/logo.png" x="203" y="266" width="48" height="48" preserveAspectRatio="xMidYMid meet" />
        <text className="journey-text-card" x="256" y="285">XMR Checkout</text>
        <text className="journey-text-card-sub" x="256" y="304">View-only</text>
      </g>

      <InfoLine d="M364 290H442" prefix={prefix} on="6" />
      <text className="journey-text-route" x="398" y="272" textAnchor="middle">Webhook</text>

      <Badge step={1} x={196} y={252} />
      <Badge step={2} x={72} y={226} />
      <Badge step={3} x={216} y={108} />
      <Badge step={4} x={286} y={226} />
      <Badge step={5} x={610} y={52} />
      <Badge step={6} x={398} y={290} />
      <Key y={344} startX={16} infoX={108} />
    </svg>
  );
}

function NarrowArt({ id }: { id: string }) {
  const prefix = `${id}-narrow`;
  return (
    <svg className="journey-art journey-art-narrow" viewBox="0 0 300 440" role="img" aria-labelledby={`${prefix}-title`}>
      <title id={`${prefix}-title`}>{artDescription}</title>
      <Arrowheads prefix={prefix} />

      <rect x="10" y="10" width="150" height="104" rx="14" fill="#fffaf2" stroke="#10121730" />
      <text className="journey-text-strong" x="22" y="31">Customer</text>
      <g className="journey-obj" data-on="2 3 5">
        <JourneyIcon name="phone" x={24} y={37} size={44} />
        <JourneyIcon name="qrCode" x={78} y={37} size={44} />
      </g>
      <text className="journey-text-sub" x="22" y="101">Pays from own wallet</text>

      <rect x="10" y="272" width="280" height="136" rx="14" fill="#f1e5d2" />
      <text className="journey-text-strong" x="153" y="291" textAnchor="middle">Your business</text>
      <g className="journey-obj" data-on="3 5">
        <rect x="20" y="300" width="130" height="98" rx="12" fill="#fffaf2" stroke="#c0733f" strokeWidth="1.5" />
        <JourneyIcon name="wallet" x={63} y={303} size={44} tint={warmTint} />
      </g>
      <text className="journey-text-strong" x="85" y="364" textAnchor="middle">Your wallet</text>
      <text className="journey-text-sub" x="85" y="382" textAnchor="middle">Only you can spend</text>
      <g className="journey-obj" data-on="6">
        <rect x="160" y="300" width="120" height="98" rx="12" fill="#fffaf2" stroke="#8a735b" strokeWidth="1.25" strokeDasharray="4 4" />
        <JourneyIcon name="storefront" x={198} y={303} size={44} tint={warmTint} />
      </g>
      <text className="journey-text-strong" x="220" y="364" textAnchor="middle">Your store</text>
      <text className="journey-text-sub" x="220" y="382" textAnchor="middle">Optional</text>

      <InfoLine d="M220 160V70Q220 62 212 62H166" prefix={prefix} on="2" />
      <text className="journey-text-route" x="172" y="52">Checkout page</text>

      <PaymentLine d="M85 116V296" prefix={prefix} />
      <text className="journey-text-strong" x="70" y="140" textAnchor="end">XMR, sent</text>
      <text className="journey-text-strong" x="70" y="156" textAnchor="end">directly</text>

      <g className="journey-route" data-on="4">
        <circle cx="85" cy="200" r="20" fill="none" stroke={infoColor} strokeWidth="2" strokeDasharray="4 4" />
        <path d="M158 200H110" fill="none" stroke={infoColor} strokeWidth="2" strokeDasharray="5 5" markerEnd={`url(#${prefix}-info)`} />
      </g>
      <text className="journey-text-route" x="133" y="189" textAnchor="middle">Detects</text>
      <MoneroCoin cx={85} cy={200} r={14} className="journey-coin-narrow" />

      <g className="journey-obj journey-obj-card" data-on="1 2 4 6">
        <rect x="158" y="160" width="132" height="80" rx="14" fill="#101217" />
        <image href="/logo.png" x="163" y="169" width="28" height="28" preserveAspectRatio="xMidYMid meet" />
        <text className="journey-text-card" x="194" y="188">XMR Checkout</text>
        <text className="journey-text-card-sub" x="168" y="213">View-only access,</text>
        <text className="journey-text-card-sub" x="168" y="228">cannot spend</text>
      </g>

      <InfoLine d="M220 240V297" prefix={prefix} on="6" />
      <text className="journey-text-route" x="232" y="263">Webhook</text>

      <Badge step={1} x={280} y={160} />
      <Badge step={2} x={220} y={112} />
      <Badge step={3} x={85} y={136} />
      <Badge step={4} x={133} y={216} />
      <Badge step={5} x={20} y={300} />
      <Badge step={6} x={220} y={264} />
      <Key y={428} startX={10} infoX={110} />
    </svg>
  );
}

function StepDetail({ step, index }: { step: Step; index: number }) {
  return (
    <>
      <p className="journey-detail-role">{String(index + 1).padStart(2, "0")} / 06 <span>{step.role}</span></p>
      <h3>{step.title}</h3>
      <p>{step.detail}</p>
      <p className="journey-detail-note">{step.note}</p>
    </>
  );
}

export function InvoiceJourney() {
  const [active, setActive] = useState(0);
  const id = useId();
  const step = steps[active];
  const select = (index: number) => setActive(index);

  return (
    <div className="checkout-console invoice-journey" role="region" aria-labelledby={`${id}-title`}>
      <div className="console-topbar"><h2 id={`${id}-title`}>How a payment reaches your wallet</h2></div>
      <div className="journey-scene" data-step={active + 1}>
        <WideArt id={id} />
        <NarrowArt id={id} />
      </div>
      <div className="journey-status">
        <span className="journey-status-label">Example invoice</span>
        <StatusBadge className="journey-status-badge" label={step.status.label} tone={step.status.tone} />
        <span>{step.status.confirmations}</span>
      </div>
      <div className="journey-explore">Explore each step</div>
      <div className="journey-steps" role="group" aria-label="Invoice journey steps">
        {steps.map((item, index) => <button key={item.title} type="button" aria-pressed={active === index} aria-controls={`${id}-detail`} onMouseEnter={() => select(index)} onFocus={() => select(index)} onClick={() => select(index)}><span>{String(index + 1).padStart(2, "0")}</span>{item.title}</button>)}
      </div>
      <div className="journey-detail">
        {steps.map((item, index) => (
          <div key={item.title} className="journey-detail-content journey-detail-sizer" aria-hidden="true"><StepDetail step={item} index={index} /></div>
        ))}
        <div className="journey-detail-content" id={`${id}-detail`} role="region" aria-label="Selected step explanation" aria-live="polite" aria-atomic="true">
          <StepDetail step={step} index={active} />
        </div>
      </div>
    </div>
  );
}
