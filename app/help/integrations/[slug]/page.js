import { notFound } from "next/navigation";
import Link from "next/link";
import { MarkdownDocViewer } from "@/components/markdown-doc-viewer";
import { integrationDocs, readIntegrationDoc } from "@/lib/integration-docs";

export function generateStaticParams() {
  return integrationDocs
    .filter((doc) => doc.slug !== "overview")
    .map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }) {
  const doc = integrationDocs.find((item) => item.slug === params.slug);

  if (!doc) {
    return {
      title: "Integration Docs | Collato.io",
    };
  }

  return {
    title: `${doc.title} | Collato.io`,
    description: doc.description,
  };
}

export default async function IntegrationDocPage({ params }) {
  const doc = await readIntegrationDoc(params.slug);

  if (!doc) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-base-300 bg-base-100 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Integration docs</p>
          <p className="mt-1 text-sm text-base-content/70">{doc.description}</p>
        </div>
        <Link href="/help/integrations" className="btn btn-outline btn-sm">
          All integration docs
        </Link>
      </div>

      <article className="max-w-none">
        <MarkdownDocViewer markdown={doc.markdown} />
      </article>
    </div>
  );
}
