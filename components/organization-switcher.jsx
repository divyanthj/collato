"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function OrganizationSwitcher({ organizations = [], selectedOrganizationSlug = "" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (!Array.isArray(organizations) || organizations.length === 0) {
    return null;
  }

  const selectedSlug = selectedOrganizationSlug || organizations[0]?.slug || "";

  const handleChange = (event) => {
    const nextSlug = event.target.value;
    if (!nextSlug || nextSlug === selectedSlug) {
      return;
    }

    startTransition(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("org", nextSlug);
      params.delete("orgCreated");
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <label className="form-control min-w-[260px]">
      <div className="label min-h-7 py-0">
        <span className="label-text text-xs uppercase tracking-[0.2em] text-primary/60">Organization</span>
      </div>
      <select className="select select-bordered h-11" value={selectedSlug} onChange={handleChange} disabled={isPending}>
        {organizations.map((organization) => (
          <option key={organization.slug} value={organization.slug}>
            {organization.name} ({organization.role})
          </option>
        ))}
      </select>
    </label>
  );
}
