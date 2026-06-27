import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../lib/shop.server";
import { PLANS, type PlanName } from "../billing/plans";
import prisma from "../db.server";

const PAID_PLANS: PlanName[] = ["starter", "growth", "pro"];
const isTest = process.env.NODE_ENV !== "production";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  await ensureShop(session.shop);

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: PAID_PLANS,
    isTest,
  });

  const activeName = appSubscriptions[0]?.name ?? null;
  const currentPlan: PlanName =
    activeName && PAID_PLANS.includes(activeName as PlanName)
      ? (activeName as PlanName)
      : "free";

  // Keep the persisted plan in sync with Shopify's billing state.
  await prisma.shop.update({
    where: { shopDomain: session.shop },
    data: { planName: currentPlan, billingStatus: hasActivePayment ? "active" : "none" },
  });

  return {
    currentPlan,
    plans: PAID_PLANS.map((p) => PLANS[p]),
    free: PLANS.free,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const form = await request.formData();
  const plan = String(form.get("plan"));
  const returnUrl = `${process.env.SHOPIFY_APP_URL}/app/billing`;

  if (plan === "free") {
    const { appSubscriptions } = await billing.check({ plans: PAID_PLANS, isTest });
    const active = appSubscriptions[0];
    if (active) {
      await billing.cancel({ subscriptionId: active.id, isTest, prorate: true });
    }
    return { ok: true as const };
  }

  if (PAID_PLANS.includes(plan as PlanName)) {
    // Throws a redirect to Shopify's subscription confirmation page.
    await billing.request({ plan: plan as PlanName, isTest, returnUrl });
  }

  return { ok: true as const };
};

export default function Billing() {
  const { currentPlan, plans, free } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";

  const choose = (plan: string) => fetcher.submit({ plan }, { method: "POST" });

  return (
    <s-page heading="Billing">
      <s-section heading="Plans">
        <s-paragraph>
          <s-text color="subdued">
            You are on the <s-text type="strong">{PLAN_LABEL[currentPlan]}</s-text> plan.
          </s-text>
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <PlanCard
            name="free"
            label={free.label}
            price="Free"
            features={free.features}
            current={currentPlan === "free"}
            busy={busy}
            onChoose={choose}
          />
          {plans.map((p) => (
            <PlanCard
              key={p.name}
              name={p.name}
              label={p.label}
              price={`$${p.priceUsd}/mo`}
              features={p.features}
              current={currentPlan === p.name}
              busy={busy}
              onChoose={choose}
            />
          ))}
        </s-stack>
      </s-section>
    </s-page>
  );
}

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
};

function PlanCard({
  name,
  label,
  price,
  features,
  current,
  busy,
  onChoose,
}: {
  name: string;
  label: string;
  price: string;
  features: string[];
  current: boolean;
  busy: boolean;
  onChoose: (plan: string) => void;
}) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      minInlineSize="220px"
      {...(current ? { background: "subdued" } : {})}
    >
      <s-stack direction="block" gap="small-200">
        <s-heading>{label}</s-heading>
        <s-text type="strong">{price}</s-text>
        <s-unordered-list>
          {features.map((f) => (
            <s-list-item key={f}>{f}</s-list-item>
          ))}
        </s-unordered-list>
        {current ? (
          <s-badge tone="success">Current plan</s-badge>
        ) : (
          <s-button
            variant="primary"
            onClick={() => onChoose(name)}
            {...(busy ? { loading: true } : {})}
          >
            {name === "free" ? "Downgrade" : "Choose plan"}
          </s-button>
        )}
      </s-stack>
    </s-box>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
