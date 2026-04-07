const appConfig = {
  appName: "Collato.io",
  appDescription:
    "Turn messy workflows into clear, structured reports with shared workspaces for project knowledge, updates, tasks, and grounded AI answers.",
  domainName: "collato.io",
  brand: {
    tagline: "Turn messy workflows into clear, structured reports.",
    heroKicker: "Turn messy workflows into clear, structured reports.",
    heroHeadline: "Turn scattered project signals into one shared operating memory.",
    heroBody:
      "Collato.io brings files, field updates, team decisions, and AI answers into the same workspace so the whole project team can move from context switching to coordinated execution and turn messy workflows into clear, structured reports.",
  },
  resend: {
    fromNoReply: "Collato.io <hello@resend.collato.io>",
    replyTo: "support@collato.io",
  },
  lemonsqueezy: {
    storeId: "91733",
    productId: "",
    webhookPath: "/api/webhook/lemonsqueezy",
    plans: {
      monthly: {
        key: "monthly",
        name: "Monthly",
        interval: "month",
        variantId: "1498029",
      },
      annual: {
        key: "annual",
        name: "Annual",
        interval: "year",
        variantId: "1498033",
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
        price: 14.99,
        priceLabel: "$14.99",
        unitLabel: "per member / month",
        variantId: "1498029",
      },
      {
        key: "annual",
        name: "Annual",
        interval: "year",
        price: 149.99,
        priceLabel: "$149.99",
        unitLabel: "per member / year",
        monthlyEquivalentLabel: "$12.50 per member / month",
        variantId: "1498033",
      },
    ],
  },
  auth: {
    loginUrl: "/api/auth/signin",
    callbackUrl: "/dashboard",
  },
};

export default appConfig;
