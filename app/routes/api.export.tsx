import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getPlan } from "../billing/plans";
import { runScan } from "../scoring/scan.server";
import { toCsv } from "../lib/csv";
import prisma from "../db.server";

// CSV export of the latest scan (brief §12 Feature 7). Respects the plan's CSV limit.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  const plan = getPlan(shop?.planName);

  const { rows } = await runScan(admin, session.shop, plan.scanLimit);
  const limited = rows.slice(0, plan.csvLimit);

  const headers = [
    "Product title",
    "Handle",
    "Current score",
    "Readiness level",
    "Issue count",
    "Issues",
  ];
  const body = limited.map((r) => [
    r.title,
    r.handle,
    String(r.score),
    r.levelLabel,
    String(r.issueCount),
    r.issues.join(" | "),
  ]);

  const csv = toCsv(headers, body);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ai-storefront-readiness.csv"',
    },
  });
};
