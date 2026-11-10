import { publicPageMetadata } from "../../../lib/site-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import PageIntroBand from "../../../components/page-intro-band";
import CopyCodeBlock from "../../../components/copy-code-block";
import StatusBadge from "../../../components/status-badge";
import { rich } from "../../../lib/i18n/rich";
import { getI18n } from "../../../lib/i18n/server";
import type { Translate } from "../../../lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return publicPageMetadata({ title: t("docs.metaTitle"), description: t("docs.metaDescription"), path: "/docs", locale });
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  "http://localhost:8000";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "http://localhost:3000";
const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");

const methodStyles: Record<string, string> = {
  GET: "bg-emerald-900/10 text-emerald-800",
  POST: "bg-amber-900/20 text-amber-800",
  DELETE: "bg-red-900/10 text-red-700",
  PUT: "bg-blue-900/10 text-blue-800",
  PATCH: "bg-blue-900/10 text-blue-800",
};

const codeBlockClass =
  "min-w-0 max-w-full overflow-x-auto rounded-xl border border-cream/20 bg-ink px-5 py-4 pr-24 text-xs leading-relaxed text-cream shadow-soft sm:px-6 sm:py-5";

const endpointGroupsFor = (t: Translate) => [
{
  "title": t("docs.ref.r001"),
  "auth": t("docs.ref.r002"),
  "items": [
    {
      "method": "GET",
      "path": "/api/core/payment-links",
      "description": t("docs.ref.r003")
    },
    {
      "method": "POST",
      "path": "/api/core/payment-links",
      "description": t("docs.ref.r004")
    },
    {
      "method": "PATCH",
      "path": "/api/core/payment-links/{link_id}",
      "description": t("docs.ref.r005")
    },
    {
      "method": "DELETE",
      "path": "/api/core/payment-links/{link_id}",
      "description": t("docs.ref.r179")
    },
    {
      "method": "GET",
      "path": "/api/core/payment-links/status",
      "description": t("docs.ref.r006")
    }
  ]
},
{
  "title": t("docs.ref.r007"),
  "auth": t("docs.ref.r008"),
  "items": [
    {
      "method": "GET",
      "path": "/api/core/public/payment-links/{token}",
      "description": t("docs.ref.r009")
    },
    {
      "method": "POST",
      "path": "/api/core/public/payment-links/{token}/invoices",
      "description": t("docs.ref.r010")
    }
  ]
},
{
  "title": t("docs.ref.r011"),
  "auth": t("docs.ref.r012"),
  "items": [
    { "method": "GET", "path": "/api/core/terminals", "description": t("docs.ref.r013") },
    { "method": "POST", "path": "/api/core/terminals", "description": t("docs.ref.r014") },
    { "method": "PATCH", "path": "/api/core/terminals/{terminal_id}", "description": t("docs.ref.r015") },
    { "method": "GET", "path": "/api/core/terminals/{terminal_id}/link", "description": t("docs.ref.r178") },
    { "method": "POST", "path": "/api/core/terminals/{terminal_id}/rotate", "description": t("docs.ref.r016") },
    { "method": "DELETE", "path": "/api/core/terminals/{terminal_id}", "description": t("docs.ref.r185") },
    { "method": "GET", "path": "/api/core/terminal/status", "description": t("docs.ref.r017") },
    { "method": "POST", "path": "/api/core/terminal/invoices", "description": t("docs.ref.r018") },
    { "method": "GET", "path": "/api/core/terminal/invoices/{invoice_id}", "description": t("docs.ref.r019") },
    { "method": "POST", "path": "/api/core/terminal/invoices/{invoice_id}/cancel", "description": t("docs.ref.r020") }
  ]
},
  {
    title: t("docs.ref.r021"),
    auth: t("docs.ref.r008"),
    items: [
      {
        method: "POST",
        path: "/api/core/auth/login",
        description:
          t("docs.ref.r022"),
      },
    ],
  },
  {
    title: t("docs.ref.r023"),
    auth: t("docs.ref.r008"),
    items: [
      {
        method: "GET",
        path: "/api/core/public/invoice/{invoice_id}",
        description: t("docs.ref.r024"),
      },
      {
        method: "GET",
        path: "/api/core/public/invoice/{invoice_id}/continue",
        description:
          t("docs.ref.r025"),
      },
      {
        method: "GET",
        path: "/api/core/public/system/status",
        description:
          t("docs.ref.r026"),
      },
      {
        method: "GET",
        path: "/api/core/public/rates/{currency}",
        description:
          t("docs.ref.r027"),
      },
    ],
  },
  {
    title: t("docs.ref.r028"),
    auth: t("docs.ref.r002"),
    items: [
      {
        method: "GET",
        path: "/api/core/invoices",
        description:
          t("docs.ref.r029"),
      },
      {
        method: "GET",
        path: "/api/core/invoices/export.csv",
        description: t("docs.ref.r030"),
      },
      {
        method: "GET",
        path: "/api/core/invoices/{invoice_id}",
        description: t("docs.ref.r031"),
      },
      {
        method: "POST",
        path: "/api/core/invoices",
        description: t("docs.ref.r032"),
      },
      {
        method: "DELETE",
        path: "/api/core/invoices/{invoice_id}",
        description:
          t("docs.ref.r033"),
      },
      {
        method: "GET",
        path: "/api/core/invoices/{invoice_id}/transfers",
        description: t("docs.ref.r034"),
      },
      {
        method: "GET",
        path: "/api/core/system/status",
        description: t("docs.ref.r180"),
      },
      {
        method: "GET",
        path: "/api/core/subaddresses/status",
        description: t("docs.ref.r181"),
      },
    ],
  },
  {
    title: t("docs.ref.r035"),
    auth: t("docs.ref.r002"),
    items: [
      {
        method: "GET",
        path: "/api/core/webhooks",
        description: t("docs.ref.r036"),
      },
      {
        method: "GET",
        path: "/api/core/webhooks/history",
        description: t("docs.ref.r037"),
      },
      {
        method: "POST",
        path: "/api/core/webhooks/deliveries/{delivery_id}/redeliver",
        description: t("docs.ref.r038"),
      },
      {
        method: "POST",
        path: "/api/core/webhooks",
        description:
          t("docs.ref.r039"),
      },
      {
        method: "DELETE",
        path: "/api/core/webhooks/{webhook_id}",
        description: t("docs.ref.r040"),
      },
    ],
  },
  {
    title: t("docs.ref.r041"),
    auth: t("docs.ref.r002"),
    items: [
      {
        method: "POST",
        path: "/api/core/api-credentials/reset",
        description: t("docs.ref.r042"),
      },
      {
        method: "PATCH",
        path: "/api/core/profile",
        description:
          t("docs.ref.r043"),
      },
    ],
  },
  {
    title: t("docs.ref.r044"),
    auth: t("docs.ref.r045"),
    items: [
      {
        method: "GET",
        path: "/api/v1/stores",
        description: t("docs.ref.r046"),
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}",
        description: t("docs.ref.r047"),
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}/payment-methods",
        description: t("docs.ref.r048"),
      },
    ],
  },
  {
    title: t("docs.ref.r049"),
    auth: t("docs.ref.r045"),
    items: [
      {
        method: "POST",
        path: "/api/v1/stores/{store_id}/invoices",
        description: t("docs.ref.r050"),
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}/invoices",
        description: t("docs.ref.r182"),
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}/invoices/{invoice_id}",
        description: t("docs.ref.r051"),
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}/invoices/{invoice_id}/payment-methods",
        description: t("docs.ref.r052"),
      },
      {
        method: "POST",
        path: "/api/v1/stores/{store_id}/invoices/{invoice_id}/status",
        description: t("docs.ref.r053"),
      },
    ],
  },
  {
    title: t("docs.ref.r054"),
    auth: t("docs.ref.r045"),
    items: [
      {
        method: "POST",
        path: "/api/v1/stores/{store_id}/webhooks",
        description: t("docs.ref.r055"),
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}/webhooks",
        description: t("docs.ref.r056"),
      },
      {
        method: "GET",
        path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
        description: t("docs.ref.r057"),
      },
      {
        method: "PUT",
        path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
        description: t("docs.ref.r058"),
      },
      {
        method: "DELETE",
        path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
        description: t("docs.ref.r059"),
      },
    ],
  },
  {
    title: t("docs.ref.r060"),
    auth: t("docs.ref.r045"),
    items: [
      {
        method: "GET",
        path: "/api/v1/server/info",
        description: t("docs.ref.r061"),
      },
      {
        method: "GET",
        path: "/api/v1/api-keys/current",
        description: t("docs.ref.r062"),
      },
    ],
  },
];

const endpointRequirementsFor = (t: Translate): EndpointRequirement[] => [
{
  "method": "GET",
  "path": "/api/core/payment-links",
  "auth": t("docs.ref.r002"),
  "required": [],
  "optional": [],
  "notes": [
    t("docs.ref.r063")
  ]
},
{
  "method": "POST",
  "path": "/api/core/payment-links",
  "auth": t("docs.ref.r002"),
  "required": [
    "title",
    t("docs.ref.r064"),
    t("docs.ref.r065")
  ],
  "optional": [
    "description",
    t("docs.ref.r066"),
    "confirmation_target",
    "checkout_continue_url",
    "confirmation_message",
    "enabled"
  ],
  "notes": [
    t("docs.ref.r067"),
    t("docs.ref.r068"),
    t("docs.ref.r069"),
    t("docs.ref.r070"),
    t("docs.ref.r071"),
    t("docs.ref.r072"),
    t("docs.ref.r073")
  ]
},
{
  "method": "PATCH",
  "path": "/api/core/payment-links/{link_id}",
  "auth": t("docs.ref.r002"),
  "required": [
    t("docs.ref.r074"),
    t("docs.ref.r075")
  ],
  "optional": [],
  "notes": [
    t("docs.ref.r076"),
    t("docs.ref.r077"),
    t("docs.ref.r078")
  ]
},
{
  "method": "GET",
  "path": "/api/core/payment-links/status",
  "auth": t("docs.ref.r002"),
  "required": [],
  "optional": [],
  "notes": [
    t("docs.ref.r079"),
    t("docs.ref.r080")
  ]
},
{
  "method": "GET",
  "path": "/api/core/public/payment-links/{token}",
  "auth": t("docs.ref.r008"),
  "required": [
    t("docs.ref.r081")
  ],
  "optional": [],
  "notes": [
    t("docs.ref.r082"),
    t("docs.ref.r083")
  ]
},
{
  "method": "POST",
  "path": "/api/core/public/payment-links/{token}/invoices",
  "auth": t("docs.ref.r008"),
  "required": [
    t("docs.ref.r081"),
    t("docs.ref.r084")
  ],
  "optional": [t("docs.ref.r183"), t("docs.ref.r184")],
  "notes": [
    t("docs.ref.r085"),
    t("docs.ref.r086"),
    t("docs.ref.r087"),
    t("docs.ref.r088"),
    t("docs.ref.r089")
  ]
},
{
  "method": "POST",
  "path": "/api/core/terminals",
  "auth": t("docs.ref.r002"),
  "required": ["name"],
  "optional": [t("docs.ref.r090"), t("docs.ref.r091"), t("docs.ref.r092"), t("docs.ref.r093")],
  "notes": [
    t("docs.ref.r094"),
    t("docs.ref.r095")
  ]
},
{
  "method": "POST",
  "path": "/api/core/terminal/invoices",
  "auth": t("docs.ref.r096"),
  "required": [t("docs.ref.r097"), t("docs.ref.r098")],
  "optional": [t("docs.ref.r099"), t("docs.ref.r100")],
  "notes": [
    t("docs.ref.r101"),
    t("docs.ref.r102"),
    t("docs.ref.r103")
  ]
},
{
  "method": "POST",
  "path": "/api/core/terminal/invoices/{invoice_id}/cancel",
  "auth": t("docs.ref.r096"),
  "required": [t("docs.ref.r104")],
  "optional": [],
  "notes": [
    t("docs.ref.r105"),
    t("docs.ref.r106")
  ]
},
  {
    method: "POST",
    path: "/api/core/auth/login",
    auth: t("docs.ref.r008"),
    required: ["payment_address", "view_key"],
    optional: [],
    notes: [
      t("docs.ref.r107"),
      t("docs.ref.r108"),
    ],
  },
  {
    method: "GET",
    path: "/api/core/public/invoice/{invoice_id}",
    auth: t("docs.ref.r008"),
    required: [t("docs.ref.r109")],
    optional: [],
    notes: [
      t("docs.ref.r110"),
      t("docs.ref.r111"),
    ],
  },
  {
    method: "GET",
    path: "/api/core/public/invoice/{invoice_id}/continue",
    auth: t("docs.ref.r008"),
    required: [t("docs.ref.r109")],
    optional: [],
    notes: [
      t("docs.ref.r112"),
      t("docs.ref.r113"),
    ],
  },
  {
    method: "GET",
    path: "/api/core/public/system/status",
    auth: t("docs.ref.r008"),
    required: [],
    optional: [],
    notes: [
      t("docs.ref.r114"),
      t("docs.ref.r115"),
    ],
  },
  {
    method: "GET",
    path: "/api/core/public/rates/{currency}",
    auth: t("docs.ref.r008"),
    required: [t("docs.ref.r116")],
    optional: [],
    notes: [
      t("docs.ref.r117"),
      t("docs.ref.r118"),
    ],
  },
  {
    method: "GET",
    path: "/api/core/invoices",
    auth: t("docs.ref.r002"),
    required: [],
    optional: [
      t("docs.ref.r119"),
      t("docs.ref.r120"),
      "status",
      t("docs.ref.r121"),
      t("docs.ref.r122"),
      t("docs.ref.r123"),
      t("docs.ref.r124"),
      t("docs.ref.r125"),
      t("docs.ref.r126"),
      t("docs.ref.r186"),
    ],
    notes: [
      t("docs.ref.r127"),
      t("docs.ref.r128"),
      t("docs.ref.r129"),
    ],
  },
  {
    method: "GET",
    path: "/api/core/invoices/export.csv",
    auth: t("docs.ref.r002"),
    required: [],
    optional: [
      t("docs.ref.r121"),
      "status",
      "q",
      "sort",
      "order",
      "created_from",
      "created_to",
      "source",
    ],
    notes: [t("docs.ref.r130")],
  },
  {
    method: "GET",
    path: "/api/core/invoices/{invoice_id}",
    auth: t("docs.ref.r002"),
    required: [t("docs.ref.r109")],
    optional: [],
    notes: [t("docs.ref.r131")],
  },
  {
    method: "GET",
    path: "/api/core/webhooks",
    auth: t("docs.ref.r002"),
    required: [],
    optional: [],
    notes: [t("docs.ref.r132")],
  },
  {
    method: "GET",
    path: "/api/core/webhooks/history",
    auth: t("docs.ref.r002"),
    required: [],
    optional: [t("docs.ref.r133"), t("docs.ref.r120")],
    notes: [t("docs.ref.r134")],
  },
  {
    method: "POST",
    path: "/api/core/webhooks/deliveries/{delivery_id}/redeliver",
    auth: t("docs.ref.r002"),
    required: [t("docs.ref.r135")],
    optional: [],
    notes: [t("docs.ref.r136")],
  },
  {
    method: "POST",
    path: "/api/core/webhooks",
    auth: t("docs.ref.r002"),
    required: [t("docs.ref.r137")],
    optional: ["url", "event_urls", "events"],
    notes: [
      t("docs.ref.r138"),
      t("docs.ref.r139"),
      t("docs.ref.r140"),
      t("docs.ref.r141"),
    ],
  },
  {
    method: "DELETE",
    path: "/api/core/webhooks/{webhook_id}",
    auth: t("docs.ref.r002"),
    required: [t("docs.ref.r142")],
    optional: [],
    notes: [t("docs.ref.r143")],
  },
  {
    method: "POST",
    path: "/api/core/api-credentials/reset",
    auth: t("docs.ref.r002"),
    required: [t("docs.ref.r144")],
    optional: [],
    notes: [t("docs.ref.r145")],
  },
  {
    method: "PATCH",
    path: "/api/core/profile",
    auth: t("docs.ref.r002"),
    required: [],
    optional: ["btcpay_checkout_style", "default_confirmation_target"],
    notes: [
      t("docs.ref.r146"),
      t("docs.ref.r147"),
    ],
  },
  {
    method: "POST",
    path: "/api/core/invoices",
    auth: t("docs.ref.r002"),
    required: [t("docs.ref.r148")],
    optional: [
      t("docs.ref.r149"),
      t("docs.ref.r150"),
      "metadata",
      t("docs.ref.r151"),
    ],
    notes: [
      t("docs.ref.r152"),
      t("docs.ref.r153"),
    ],
  },
  {
    method: "DELETE",
    path: "/api/core/invoices/{invoice_id}",
    auth: t("docs.ref.r002"),
    required: [],
    optional: [],
    notes: [
      t("docs.ref.r154"),
    ],
  },
  {
    method: "GET",
    path: "/api/core/invoices/{invoice_id}/transfers",
    auth: t("docs.ref.r002"),
    required: [t("docs.ref.r109")],
    optional: [],
    notes: [
      t("docs.ref.r155"),
      t("docs.ref.r156"),
    ],
  },
  {
    method: "GET",
    path: "/api/v1/stores",
    auth: t("docs.ref.r045"),
    required: [],
    optional: [],
    notes: [
      t("docs.ref.r157"),
      t("docs.ref.r158"),
      t("docs.ref.r159"),
    ],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}",
    auth: t("docs.ref.r045"),
    required: [t("docs.ref.r160")],
    optional: [],
    notes: [
      t("docs.ref.r161"),
      t("docs.ref.r162"),
    ],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}/payment-methods",
    auth: t("docs.ref.r045"),
    required: [t("docs.ref.r160")],
    optional: [],
    notes: [t("docs.ref.r163")],
  },
  {
    method: "POST",
    path: "/api/v1/stores/{store_id}/invoices",
    auth: t("docs.ref.r045"),
    required: [t("docs.ref.r160"), "amount", "currency"],
    optional: ["metadata", "checkout"],
    notes: [
      t("docs.ref.r164"),
      t("docs.ref.r165"),
    ],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}/invoices/{invoice_id}",
    auth: t("docs.ref.r045"),
    required: [t("docs.ref.r160"), t("docs.ref.r109")],
    optional: [],
    notes: [t("docs.ref.r166")],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}/invoices/{invoice_id}/payment-methods",
    auth: t("docs.ref.r045"),
    required: [t("docs.ref.r160"), t("docs.ref.r109")],
    optional: [],
    notes: [
      t("docs.ref.r167"),
      t("docs.ref.r168"),
    ],
  },
  {
    method: "POST",
    path: "/api/v1/stores/{store_id}/invoices/{invoice_id}/status",
    auth: t("docs.ref.r045"),
    required: [t("docs.ref.r160"), t("docs.ref.r109"), "status"],
    optional: [],
    notes: [t("docs.ref.r169")],
  },
  {
    method: "POST",
    path: "/api/v1/stores/{store_id}/webhooks",
    auth: t("docs.ref.r045"),
    required: [t("docs.ref.r160"), "url", "authorizedEvents"],
    optional: ["enabled", "automaticRedelivery"],
    notes: [
      t("docs.ref.r170"),
      t("docs.ref.r171"),
      t("docs.ref.r172"),
    ],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}/webhooks",
    auth: t("docs.ref.r045"),
    required: [t("docs.ref.r160")],
    optional: [],
    notes: [t("docs.ref.r132")],
  },
  {
    method: "GET",
    path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
    auth: t("docs.ref.r045"),
    required: [t("docs.ref.r160"), t("docs.ref.r142")],
    optional: [],
    notes: [t("docs.ref.r173")],
  },
  {
    method: "PUT",
    path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
    auth: t("docs.ref.r045"),
    required: [t("docs.ref.r160"), t("docs.ref.r142")],
    optional: ["enabled", "automaticRedelivery", "url", "authorizedEvents"],
    notes: [t("docs.ref.r174")],
  },
  {
    method: "DELETE",
    path: "/api/v1/stores/{store_id}/webhooks/{webhook_id}",
    auth: t("docs.ref.r045"),
    required: [t("docs.ref.r160"), t("docs.ref.r142")],
    optional: [],
    notes: [t("docs.ref.r143")],
  },
  {
    method: "GET",
    path: "/api/v1/server/info",
    auth: t("docs.ref.r045"),
    required: [],
    optional: [],
    notes: [t("docs.ref.r175")],
  },
  {
    method: "GET",
    path: "/api/v1/api-keys/current",
    auth: t("docs.ref.r045"),
    required: [],
    optional: [],
    notes: [
      t("docs.ref.r176"),
      t("docs.ref.r177"),
    ],
  },
];

const mono = (text: string) => <span className="font-mono text-ink">{text}</span>;

type EndpointRequirement = {
  method: string;
  path: string;
  auth: string;
  required: string[];
  optional: string[];
  notes: string[];
};

export default async function DocsPage() {
  const { t } = await getI18n();
  const endpointGroups = endpointGroupsFor(t);
  const endpointRequirements = endpointRequirementsFor(t);
  const requirementsByEndpoint = Object.fromEntries(
    endpointRequirements.map((entry) => [`${entry.method} ${entry.path}`, entry]),
  );
  // BTCPay compatibility routes live under /api/v1; group logic uses paths, not translated titles.
  const isBtcpay = (group: (typeof endpointGroups)[number]) => group.items[0]?.path.startsWith("/api/v1") ?? false;
  return (
    <main id="main-content" tabIndex={-1} className="reference-page docs-page px-[6vw] pb-20 pt-8 text-ink">
      <div className="mx-auto w-full max-w-7xl">
        <section aria-label={t("docs.introLabel")}>
          <PageIntroBand
            eyebrow={t("nav.docs")}
            id="docs-title"
            title={t("docs.title")}
            description={
              <p>
                {t("docs.intro")}
              </p>
            }
          />
        </section>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
            href="/docs/integrations"
          >
            {t("docs.recipes")}
          </Link>
          <span className="text-sm text-ink-soft">
            {t("docs.recipesHelp")}
          </span>
        </div>

        <aside className="mt-5 rounded-surface border border-stroke bg-sand/60 px-5 py-4 text-sm text-ink-soft sm:px-6">
          {rich(t("docs.newToSetup"), {
            strong: (text) => <span className="font-semibold text-ink">{text}</span>,
            links: (text) => <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides/monero-payment-buttons">{text}</Link>,
            terminal: (text) => <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides/in-person-monero-checkout">{text}</Link>,
            selfhost: (text) => <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides/self-hosted-monero-checkout">{text}</Link>,
            api: (text) => <Link className="font-semibold text-ink underline decoration-clay underline-offset-4" href="/guides/monero-payment-api-webhooks">{text}</Link>,
          })}
        </aside>

        <nav
          className="sticky top-3 z-10 mt-6 grid grid-cols-2 gap-1.5 rounded-surface border border-stroke bg-card/95 p-2 shadow-soft backdrop-blur sm:flex sm:flex-wrap"
          aria-label={t("docs.sectionsLabel")}
        >
          {[
            { href: "#start", label: t("docs.navStart") },
            { href: "#payment-links", label: t("paymentLinks.title") },
            { href: "#terminals", label: t("docs.ref.r011") },
            { href: "#fiat-inputs", label: t("docs.navFiat") },
            { href: "#concepts", label: t("docs.navConcepts") },
            { href: "#api-reference", label: t("docs.apiReference") },
          ].map((item, index) => (
            <a
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-ink-soft transition hover:border-stroke hover:bg-white/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
              key={item.href}
              href={item.href}
            >
              <span className="font-mono text-xs text-ink-soft">
                0{index + 1}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        <section
          id="start"
          className="mt-8 scroll-mt-24 overflow-hidden rounded-surface border border-stroke bg-card shadow-soft"
          aria-labelledby="start-title"
        >
          <header className="flex flex-wrap items-end justify-between gap-4 px-5 py-5 sm:px-6">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-clay"
                  aria-hidden="true"
                />
                {t("docs.startHere")}
              </p>
              <h2
                className="mt-1 font-sans text-2xl font-semibold"
                id="start-title"
              >
                {t("docs.startTitle")}
              </h2>
            </div>
          </header>
          <ol className="grid divide-y divide-stroke border-y border-stroke bg-white/60 md:grid-cols-3 md:divide-x md:divide-y-0">
            <li className="min-w-0 px-5 py-5 sm:px-6">
              <span className="font-mono text-xs text-ink-soft">01</span>
              <p className="mt-2 font-semibold text-ink">
                {t("docs.connect")}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {t("docs.connectBody")}
              </p>
            </li>
            <li className="min-w-0 px-5 py-5 sm:px-6">
              <span className="font-mono text-xs text-ink-soft">02</span>
              <p className="mt-2 font-semibold text-ink">{t("guides.api.navCreate")}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {rich(t("docs.start.createBody"), { code: mono })}
              </p>
            </li>
            <li className="min-w-0 px-5 py-5 sm:px-6">
              <span className="font-mono text-xs text-ink-soft">03</span>
              <p className="mt-2 font-semibold text-ink">{t("docs.listen")}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {rich(t("docs.start.listenBody"), { code: mono })}
              </p>
            </li>
          </ol>
          <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-ink">{t("docs.minimalRequest")}</p>
              <p className="mt-2 max-w-xl text-sm text-ink-soft">
                {t("docs.minimalHelp")}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href="/docs/integrations"
                >
                  {t("docs.seeRecipes")}
                </Link>
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                  href={`${normalizedSiteUrl}/openapi.json`}
                  rel="noreferrer"
                  target="_blank"
                >
                  OpenAPI JSON
                </a>
              </div>
            </div>
            <CopyCodeBlock className={codeBlockClass}>
              <code>{`POST /api/core/invoices
Authorization: ApiKey <api_key>
Content-Type: application/json

{
  "amount_xmr": "0.125",
  "confirmation_target": 2,
  "metadata": { "order_id": "ORDER-1234" }
}`}</code>
            </CopyCodeBlock>
          </div>
        </section>

        <section id="payment-links" aria-labelledby="payment-links-title" className="mt-10 grid min-w-0 scroll-mt-24 gap-5 break-words rounded-surface border border-stroke bg-card p-5 sm:p-8">
          <h2 id="payment-links-title" className="font-sans text-2xl font-semibold">{t("docs.linksTitle")}</h2>
          <p>{t("docs.linksBody")}</p>
          <p>{rich(t("docs.links.guideBody"), {
            guide: (text) => <Link className="font-semibold underline decoration-clay underline-offset-4" href="/guides/monero-payment-buttons">{text}</Link>,
            message: (text) => <Link className="font-semibold underline decoration-clay underline-offset-4" href="/guides/monero-payment-buttons#confirmation-message">{text}</Link>,
          })}</p>
          <details className="min-w-0 rounded-xl border border-stroke p-4">
            <summary className="min-h-11 cursor-pointer font-semibold">{t("docs.examplesSummary")}</summary>
            <p className="mt-3">{t("docs.createTemplate")}</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`POST /api/core/payment-links
Authorization: ApiKey YOUR_MERCHANT_API_KEY
Content-Type: application/json

{
  "title": "Digital guide",
  "amount_fiat": "20.00",
  "currency": "EUR",
  "confirmation_target": 2,
  "enabled": true
}`}</code></CopyCodeBlock>
            <p className="mt-3">{t("docs.response201")}</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`{
  "id": "00000000-0000-4000-8000-000000000001",
  "url": "https://checkout.example/pay/YOUR_PUBLIC_TOKEN",
  "action_url": "https://checkout.example/api/core/public/payment-links/YOUR_PUBLIC_TOKEN/invoices"
}`}</code></CopyCodeBlock>
            <p className="mt-3">{t("docs.allowanceRead")}</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`{
  "supported_currencies": ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "JPY", "CNY", "HKD", "SGD", "INR", "BRL", "MXN", "SEK", "NOK", "DKK", "ZAR", "PLN", "KRW"],
  "daily_limit": 10,
  "used": 2,
  "remaining": 8,
  "window_hours": 24,
  "retrieved_at": "2026-10-30T12:00:00Z"
}`}</code></CopyCodeBlock>
            <p className="mt-3">{t("docs.links.publicPost")}</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`POST /api/core/public/payment-links/YOUR_PUBLIC_TOKEN/invoices
Content-Type: application/x-www-form-urlencoded
Content-Length: 0

HTTP/1.1 303 See Other
Location: https://checkout.example/invoice/NEW_INVOICE_ID`}</code></CopyCodeBlock>
            <p className="mt-3">{t("docs.onFailure")}</p>
            <p className="mt-3">{t("docs.links.editing")}</p>
          </details>
          <p>{rich(t("docs.links.findOperations"), { directory: (text) => <a href="#api-reference" className="font-semibold underline underline-offset-4">{text}</a> })}</p>
        </section>

        <section id="terminals" aria-labelledby="terminals-title" className="mt-10 grid min-w-0 scroll-mt-24 gap-5 break-words rounded-surface border border-stroke bg-card p-5 sm:p-8">
          <h2 id="terminals-title" className="font-sans text-2xl font-semibold">{t("docs.terminals.title")}</h2>
          <p>{t("docs.terminals.body")}</p>
          <p>{rich(t("docs.terminals.guideBody"), {
            guide: (text) => <Link className="font-semibold underline decoration-clay underline-offset-4" href="/guides/in-person-monero-checkout">{text}</Link>,
          })}</p>
          <details className="min-w-0 rounded-xl border border-stroke p-4">
            <summary className="min-h-11 cursor-pointer font-semibold">{t("docs.examplesSummary")}</summary>
            <p className="mt-3">{t("docs.terminals.create")}</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`POST /api/core/terminals
Authorization: ApiKey YOUR_MERCHANT_API_KEY
Content-Type: application/json

{
  "name": "Front counter",
  "default_currency": "EUR",
  "confirmation_target": 0,
  "expiry_minutes": 15
}`}</code></CopyCodeBlock>
            <p className="mt-3">{t("docs.terminals.createResponse")}</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`{
  "id": "00000000-0000-4000-8000-000000000002",
  "name": "Front counter",
  "enabled": true,
  "url": "https://checkout.example/terminal#k=xmrterm_YOUR_TERMINAL_KEY"
}`}</code></CopyCodeBlock>
            <p className="mt-3">{t("docs.terminals.sale")}</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`POST /api/core/terminal/invoices
Authorization: Terminal xmrterm_YOUR_TERMINAL_KEY
Idempotency-Key: 6f1c2b9e-8d4a-4c3e-9b7f-2a5d1e0c4b88
Content-Type: application/json

{
  "amount": "12.50",
  "currency": "EUR",
  "note": "Table 4"
}`}</code></CopyCodeBlock>
            <p className="mt-3">{t("docs.terminals.saleResponse")}</p>
            <CopyCodeBlock className={codeBlockClass}><code>{`{
  "id": "00000000-0000-4000-8000-000000000003",
  "status": "pending",
  "amount_xmr": "0.041234567890",
  "address": "8YOUR_INVOICE_SUBADDRESS",
  "confirmation_target": 0,
  "expires_at": "2026-11-07T12:15:00Z",
  "note": "Table 4",
  "invoice_url": "https://checkout.example/invoice/00000000-0000-4000-8000-000000000003"
}`}</code></CopyCodeBlock>
            <p className="mt-3">{t("docs.terminals.polling")}</p>
          </details>
          <p>{rich(t("docs.terminals.findOperations"), { directory: (text) => <a href="#api-reference" className="font-semibold underline underline-offset-4">{text}</a> })}</p>
        </section>

        <section
          id="fiat-inputs"
          className="mt-10 grid scroll-mt-24 overflow-hidden rounded-surface border border-stroke bg-sand/60 shadow-soft lg:grid-cols-[minmax(0,0.8fr)_minmax(420px,1.2fr)] lg:items-stretch"
          aria-labelledby="fiat-inputs-title"
        >
          <div className="px-5 py-6 sm:px-6 lg:py-7">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                className="h-2.5 w-2.5 rounded-full bg-sage"
                aria-hidden="true"
              />
              {t("docs.optionalInput")}
            </p>
            <h2
              className="mt-1 font-sans text-2xl font-semibold"
              id="fiat-inputs-title"
            >
              {t("docs.fiatTitle")}
            </h2>
            <p className="mt-3 text-ink-soft">
              {t("docs.fiatBody")}
            </p>
            <StatusBadge
              className="mt-4"
              label={t("docs.nonBinding")}
              tone="neutral"
            />
          </div>
          <CopyCodeBlock
            className={`${codeBlockClass} m-4 lg:m-0 lg:rounded-none lg:border-0 lg:shadow-none`}
          >
            <code>{`POST /api/core/invoices
Authorization: ApiKey <api_key>
Content-Type: application/json

{
  "amount_fiat": "100.00",
  "currency": "USD",
  "confirmation_target": 2,
  "checkout_continue_url": "https://merchant.example/thanks",
  "metadata": { "order_id": "ORDER-1234" }
}`}</code>
          </CopyCodeBlock>
        </section>

        <section
          id="concepts"
          className="mt-12 grid scroll-mt-24 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <header className="border-b border-stroke pb-5 sm:col-span-2 lg:col-span-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                className="h-2.5 w-2.5 rounded-full bg-clay"
                aria-hidden="true"
              />
              {t("docs.systemModel")}
            </p>
            <h2 className="mt-1 font-sans text-2xl font-semibold">
              {t("docs.conceptsTitle")}
            </h2>
            <p className="mt-1 max-w-2xl text-ink-soft">
              {t("docs.conceptsBody")}
            </p>
          </header>
          <div className="rounded-surface border border-stroke border-t-4 border-t-clay bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              {t("docs.principles")}
            </h3>
            <p className="text-ink-soft">
              {t("docs.principlesBody")}
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>{t("docs.principle1")}</li>
              <li>{t("docs.principle2")}</li>
              <li>{t("docs.principle3")}</li>
            </ul>
          </div>
          <div className="rounded-surface border border-stroke border-t-4 border-t-sage bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              {t("docs.subaddressTitle")}
            </h3>
            <p className="text-ink-soft">
              {t("docs.subaddressBody")}
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>{t("docs.subaddress1")}</li>
              <li>{t("docs.subaddress3")}</li>
              <li>{t("docs.subaddress4")}</li>
            </ul>
          </div>
          <div className="rounded-surface border border-stroke border-t-4 border-t-monero bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              {t("docs.lifecycle")}
            </h3>
            <p className="text-ink-soft">
              {t("docs.lifecycleBody")}
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>{t("docs.lifecycle1")}</li>
              <li>{t("docs.lifecycle2")}</li>
              <li>{t("docs.lifecycle3")}</li>
            </ul>
          </div>
        </section>

        <section className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-surface border border-stroke bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              {t("docs.authTitle")}
            </h3>
            <p className="text-ink-soft">
              {t("docs.authBody")}
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>{t("docs.auth1")}</li>
              <li>
                {t("docs.auth2")}
              </li>
              <li>{t("docs.auth3")}</li>
              <li>
                {t("docs.auth4")}
              </li>
            </ul>
          </div>
          <div className="rounded-surface border border-stroke bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              {t("docs.eventsTitle")}
            </h3>
            <p className="text-ink-soft">
              {t("docs.eventsBody")}
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>invoice.created</li>
              <li>
                {t("docs.eventPartial")}
              </li>
              <li>invoice.payment_detected</li>
              <li>invoice.confirmed</li>
              <li>invoice.expired</li>
              <li>
                {t("docs.events1")}
              </li>
              <li>
                {t("docs.events2")}
              </li>
              <li>
                {t("docs.events3")}
              </li>
              <li>{t("docs.events4")}</li>
              <li>
                {t("docs.events5")}
              </li>
              <li>
                {t("docs.events6")}
              </li>
            </ul>
          </div>
          <div className="rounded-surface border border-stroke bg-white/70 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">{t("docs.baseUrl")}</h3>
            <p className="text-ink-soft">{t("docs.reachedFrom")}</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>{normalizedSiteUrl}/api/core</li>
            </ul>
          </div>
        </section>

        <section className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="rounded-surface border border-stroke bg-sand/60 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              {t("docs.btcpayTitle")}
            </h3>
            <p className="text-ink-soft">
              {t("docs.btcpayBody")}
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>
                {rich(t("docs.btcpay.baseUrl"), { code: mono })}
              </li>
              <li>
                {t("docs.btcpay1")}
              </li>
              <li>
                {t("docs.btcpay2")}
              </li>
              <li>
                {t("docs.btcpay3")}
              </li>
            </ul>
          </div>
          <div className="rounded-surface border border-stroke bg-sand/60 p-6 shadow-soft">
            <h3 className="mb-2 font-sans font-semibold text-xl">
              {t("docs.btcpayWebhooks")}
            </h3>
            <p className="text-ink-soft">
              {t("docs.btcpayWebhooksBody")}
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>
                <span className="font-mono text-ink">
                  BTCPay-Sig: sha256=&lt;hmac&gt;
                </span>
              </li>
              <li>{t("docs.btcpayEvents")}</li>
              <li>
                {t("docs.btcpayDestinations")}
              </li>
            </ul>
          </div>
        </section>

        <section id="api-reference" className="mt-12 grid scroll-mt-24 gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stroke pb-5">
            <div className="max-w-[52rem]">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-sage"
                  aria-hidden="true"
                />
                {t("docs.directory")}
              </p>
              <h2 className="mt-1 font-sans font-semibold text-2xl">
                {t("docs.apiReference")}
              </h2>
              <p className="text-ink-soft">
                {t("docs.directoryBody")}
              </p>
            </div>
            <StatusBadge
              label={t("docs.api.routes", { count: endpointRequirements.length })}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {endpointGroups.map((group, index) => {
              const needsDivider =
                isBtcpay(group) &&
                endpointGroups[index - 1] &&
                !isBtcpay(endpointGroups[index - 1]);

              return (
                <Fragment key={group.title}>
                  {needsDivider ? (
                    <div
                      className="h-px w-full bg-monero/70 lg:col-span-2"
                      aria-hidden="true"
                    ></div>
                  ) : null}
                  <details
                    className="overflow-hidden rounded-surface border border-stroke bg-card shadow-soft"
                  >
                    <summary className="cursor-pointer list-none px-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clay/50 [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h3 className="font-sans font-semibold text-xl">
                            {group.title}
                          </h3>
                          <div className="mt-2">
                            <StatusBadge
                              label={t("docs.api.auth", { auth: group.auth })}
                              tone={
                                group.auth === t("docs.ref.r008") ? "success" : "pending"
                              }
                            />
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-ink-soft">
                          {t("docs.api.endpoints", { count: group.items.length })}
                        </span>
                      </div>
                    </summary>
                    <div className="border-t border-stroke bg-white/50 px-5 pb-5">
                      {group.items.map((endpoint) => {
                        const requirements =
                          requirementsByEndpoint[
                            `${endpoint.method} ${endpoint.path}`
                          ];

                        return (
                          <div
                            className="grid gap-3 border-t border-stroke py-4 first:border-t-0 sm:grid-cols-[auto_1fr] sm:gap-4"
                            key={`${endpoint.method}-${endpoint.path}`}
                          >
                            <span
                              className={`inline-flex h-7 items-center justify-center self-start rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] ${
                                methodStyles[endpoint.method] ??
                                "bg-ink/10 text-ink-soft"
                              }`}
                            >
                              {endpoint.method}
                            </span>
                            <div className="grid gap-2">
                              <div className="grid gap-1">
                                <span className="break-all font-mono text-sm text-ink">
                                  {endpoint.path}
                                </span>
                                <span className="text-sm text-ink-soft">
                                  {endpoint.description}
                                </span>
                              </div>
                              {requirements ? (
                                <details className="rounded-lg border border-ink/10 bg-white/70 px-3 py-2 text-sm text-ink-soft">
                                  <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.08em] text-ink">
                                    {t("docs.requirements")}
                                  </summary>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <span className="font-semibold text-ink">
                                        {t("docs.required")}
                                      </span>{" "}
                                      {requirements.required.length > 0
                                        ? requirements.required.join(", ")
                                        : t("docs.ref.r008")}
                                    </div>
                                    {requirements.optional.length > 0 ? (
                                      <div>
                                        <span className="font-semibold text-ink">
                                          {t("docs.optional")}
                                        </span>{" "}
                                        {requirements.optional.join(", ")}
                                      </div>
                                    ) : null}
                                    {requirements.notes.length > 0 ? (
                                      <ul className="list-disc space-y-1 pl-5">
                                        {requirements.notes.map((note) => (
                                          <li key={note}>{note}</li>
                                        ))}
                                      </ul>
                                    ) : null}
                                  </div>
                                </details>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </Fragment>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-surface border border-ink bg-ink px-5 py-4 text-sm text-cream shadow-soft">
            <span className="text-cream/70">
              {t("docs.schema")}
            </span>
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-cream/25 bg-cream/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-cream transition hover:bg-cream/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/60"
              href={`${normalizedSiteUrl}/openapi.json`}
              rel="noreferrer"
              target="_blank"
            >
              OpenAPI JSON
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
