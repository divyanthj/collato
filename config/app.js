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
    storeId: "",
    productId: "",
    webhookPath: "/api/webhook/lemonsqueezy",
    plans: {
      monthly: [
        {
          key: "team-10-monthly",
          name: "Team of 10",
          interval: "month",
          variantId: "1494935",
        },
        {
          key: "team-25-monthly",
          name: "Team of 25",
          interval: "month",
          variantId: "1494943",
        },
        {
          key: "team-50-monthly",
          name: "Team of 50",
          interval: "month",
          variantId: "1494945",
        },
      ],
      annual: [
        {
          key: "team-10-annual",
          name: "Team of 10",
          interval: "year",
          variantId: "1494955",
        },
        {
          key: "team-25-annual",
          name: "Team of 25",
          interval: "year",
          variantId: "1494956",
        },
        {
          key: "team-50-annual",
          name: "Team of 50",
          interval: "year",
          variantId: "1494957",
        },
      ],
    },
  },
  pricing: {
    currency: "USD",
    plans: {
      monthly: [
        {
          key: "team-10",
          name: "Team of 10",
          seatsIncluded: 10,
          interval: "month",
          price: 149.99,
          priceLabel: "$149.99",
          variantId: "1494935",
        },
        {
          key: "team-25",
          name: "Team of 25",
          seatsIncluded: 25,
          interval: "month",
          price: 299.99,
          priceLabel: "$299.99",
          variantId: "1494943",
        },
        {
          key: "team-50",
          name: "Team of 50",
          seatsIncluded: 50,
          interval: "month",
          price: 549.99,
          priceLabel: "$549.99",
          variantId: "1494945",
        },
      ],
      annual: [
        {
          key: "team-10",
          name: "Team of 10",
          seatsIncluded: 10,
          interval: "year",
          price: 1499.99,
          priceLabel: "$1499.99",
          variantId: "1494955",
        },
        {
          key: "team-25",
          name: "Team of 25",
          seatsIncluded: 25,
          interval: "year",
          price: 2999.99,
          priceLabel: "$2999.99",
          variantId: "1494956",
        },
        {
          key: "team-50",
          name: "Team of 50",
          seatsIncluded: 50,
          interval: "year",
          price: 4999.99,
          priceLabel: "$4999.99",
          variantId: "1494957",
        },
      ],
    },
  },
  auth: {
    loginUrl: "/api/auth/signin",
    callbackUrl: "/dashboard",
  },
};

export default appConfig;
