import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mapIntegrationHref } from "@/lib/integration-docs";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function getText(children) {
  if (typeof children === "string") {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map(getText).join("");
  }

  return "";
}

export function MarkdownDocViewer({ markdown }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1({ children }) {
          return (
            <h1 className="font-display text-4xl font-semibold text-neutral lg:text-5xl">
              {children}
            </h1>
          );
        },
        h2({ children }) {
          const id = slugify(getText(children));
          return (
            <h2 id={id} className="font-display mt-10 scroll-mt-24 text-3xl font-semibold text-neutral">
              {children}
            </h2>
          );
        },
        h3({ children }) {
          const id = slugify(getText(children));
          return (
            <h3 id={id} className="font-display mt-8 scroll-mt-24 text-2xl font-semibold text-neutral">
              {children}
            </h3>
          );
        },
        p({ children }) {
          return <p className="mt-4 text-base leading-8 text-base-content/78">{children}</p>;
        },
        ul({ children }) {
          return <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-7 text-base-content/78">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mt-4 list-decimal space-y-2 pl-6 text-base leading-7 text-base-content/78">{children}</ol>;
        },
        li({ children }) {
          return <li>{children}</li>;
        },
        a({ href = "", children }) {
          const mappedHref = mapIntegrationHref(href);

          if (mappedHref.startsWith("/")) {
            return (
              <Link href={mappedHref} className="link link-primary">
                {children}
              </Link>
            );
          }

          return (
            <a href={mappedHref} className="link link-primary" target={mappedHref.startsWith("http") ? "_blank" : undefined} rel={mappedHref.startsWith("http") ? "noreferrer" : undefined}>
              {children}
            </a>
          );
        },
        code({ className = "", children }) {
          const isBlock = className.startsWith("language-");

          if (!isBlock) {
            return (
              <code className="rounded-md border border-base-300 bg-base-100 px-1.5 py-0.5 text-sm text-primary">
                {children}
              </code>
            );
          }

          return (
            <code className={className}>
              {children}
            </code>
          );
        },
        pre({ children }) {
          return (
            <pre className="mt-4 overflow-x-auto rounded-2xl border border-base-300 bg-base-100 p-4 text-sm leading-6 text-base-content/88">
              {children}
            </pre>
          );
        },
        table({ children }) {
          return (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-base-300">
              <table className="table table-zebra">{children}</table>
            </div>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote className="mt-5 rounded-2xl border-l-4 border-primary bg-primary/5 px-5 py-4 text-base-content/80">
              {children}
            </blockquote>
          );
        },
        hr() {
          return <hr className="my-8 border-base-300" />;
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
