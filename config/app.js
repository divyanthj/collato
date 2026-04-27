const appConfig = {
  appName: "Collato.io",
  appDescription:
    "Create a workspace, capture project context and updates, then turn them into clear progress-ready reports with grounded AI help.",
  domainName: "collato.io",
  brand: {
    tagline: "Create a workspace and turn raw project signals into a clear progress summary.",
    heroKicker: "Create a workspace and turn raw project signals into a clear progress summary.",
    heroHeadline: "Turn scattered project signals into one shared operating memory and a report-ready summary.",
    heroBody:
      "Collato.io brings files, field updates, team decisions, and grounded AI answers into one workspace so your team can move from scattered inputs to a usable progress summary without rebuilding context each time.",
  },
  resend: {
    fromNoReply: "Collato.io <hello@resend.collato.io>",
    replyTo: "support@collato.io",
  },
  lemonsqueezy: {
    storeId: 91773,
    productId: "",
    webhookPath: "/api/webhook/lemonsqueezy",
    plans: {
      monthly: {
        key: "monthly",
        name: "Monthly",
        interval: "month",
        variantId: 1498029,
      },
      annual: {
        key: "annual",
        name: "Annual",
        interval: "year",
        variantId: 1498033,
      },
    },
  },
  pricing: {
    currency: "USD",
    plans: [
      {
        key: "monthly",
        name: "Monthly",
        interval: "month",
        price: 19.99,
        priceLabel: "$19.99",
        unitLabel: "per member / month",
        variantId: 1498029,
      },
      {
        key: "annual",
        name: "Annual",
        interval: "year",
        price: 199.99,
        priceLabel: "$199.99",
        unitLabel: "per member / year",
        monthlyEquivalentLabel: "$16.67 per member / month",
        variantId: 1498033,
      },
    ],
  },
  auth: {
    loginUrl: "/api/auth/signin",
    callbackUrl: "/dashboard",
  },
};

export default appConfig;
