import { redirect } from "next/navigation";
export default async function LegacyProjectWorkspacePage({ params }) {
    redirect(`/dashboard/${params.slug}`);
}

