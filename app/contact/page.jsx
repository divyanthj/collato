import Link from "next/link";
import appConfig from "@/config/app";
import { ContactForm } from "@/components/contact-form";

export const metadata = {
  title: `Contact | ${appConfig.appName}`,
  description: `Contact ${appConfig.appName} with your questions or feedback.`,
};

export default function ContactPage() {
  return (
    <main className="min-h-screen px-4 py-8 lg:px-6">
      <section className="mx-auto max-w-4xl">
        <div className="glass-panel rounded-[2rem] p-8 lg:p-10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-kicker">Contact</p>
              <h1 className="mt-2 text-4xl font-semibold text-neutral lg:text-5xl">Get in touch</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-base-content/72">
                Send a message and we will get back to you as soon as possible.
              </p>
            </div>
            <Link href="/" className="btn btn-outline btn-sm">
              Back to site
            </Link>
          </div>

          <div className="mt-8 rounded-[1.5rem] bg-base-100 p-6">
            <ContactForm />
          </div>
        </div>
      </section>
    </main>
  );
}
