import fs from "fs/promises";
import path from "path";

const docsDirectory = path.join(process.cwd(), "docs", "integrations");

export const integrationDocs = [
  {
    slug: "overview",
    fileName: "README.md",
    title: "Integration Overview",
    description: "How Collato works as an internal knowledge service for another app.",
  },
  {
    slug: "api-reference",
    fileName: "api-reference.md",
    title: "API Reference",
    description: "Internal knowledge API endpoints, payloads, responses, and errors.",
  },
  {
    slug: "agent-playbook",
    fileName: "agent-playbook.md",
    title: "AI Agent Playbook",
    description: "A step-by-step implementation guide for AI coding agents.",
  },
  {
    slug: "examples",
    fileName: "examples.md",
    title: "Examples",
    description: "Copy-paste JavaScript and Next.js integration patterns.",
  },
  {
    slug: "security-and-operations",
    fileName: "security-and-operations.md",
    title: "Security And Operations",
    description: "Secret handling, tenant isolation, rollout, and operational guidance.",
  },
];

export function getIntegrationDocBySlug(slug = "overview") {
  return integrationDocs.find((doc) => doc.slug === slug) ?? null;
}

export async function readIntegrationDoc(slug = "overview") {
  const doc = getIntegrationDocBySlug(slug);

  if (!doc) {
    return null;
  }

  const markdown = await fs.readFile(path.join(docsDirectory, doc.fileName), "utf8");

  return {
    ...doc,
    markdown,
  };
}

export function mapIntegrationHref(href = "") {
  if (!href || href.startsWith("http") || href.startsWith("#")) {
    return href;
  }

  const normalized = href.replace(/^\.\//, "");
  const target = integrationDocs.find((doc) => doc.fileName === normalized);

  if (!target) {
    return href;
  }

  return target.slug === "overview"
    ? "/help/integrations"
    : `/help/integrations/${target.slug}`;
}
