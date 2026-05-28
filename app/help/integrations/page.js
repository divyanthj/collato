import Link from "next/link";
import { MarkdownDocViewer } from "@/components/markdown-doc-viewer";
import { integrationDocs, readIntegrationDoc } from "@/lib/integration-docs";

export const metadata = {
  title: "Integration Docs | Collato.io",
  description: "Developer docs for integrating Collato into customer apps as an internal knowledge service.",
};

export default async function IntegrationDocsPage() {
  const doc = await readIntegrationDoc("overview");

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-7 text-base-content/80">
        These developer docs are rendered from Markdown in <code>docs/integrations</code>. Use them when connecting
        Collato to another app&apos;s admin panel or when giving an AI agent integration instructions.
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {integrationDocs.slice(1).map((item) => (
          <Link
            key={item.slug}
            href={`/help/integrations/${item.slug}`}
            className="rounded-2xl border border-base-300 bg-base-100 p-4 transition hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="font-semibold text-neutral">{item.title}</div>
            <p className="mt-2 text-sm leading-6 text-base-content/68">{item.description}</p>
          </Link>
        ))}
      </div>

      <article className="max-w-none">
        <MarkdownDocViewer markdown={doc.markdown} />
      </article>
    </div>
  );
}
