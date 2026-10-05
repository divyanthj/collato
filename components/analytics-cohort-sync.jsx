"use client";

import { useLayoutEffect } from "react";
import { syncAnalyticsCohort } from "@/lib/client-analytics";

// Next's beforeInteractive Script is cached after first load. Sync fresh server
// session props after navigation/refresh before passive tracking effects run.
export function AnalyticsCohortSync({ cohort }) {
  useLayoutEffect(() => {
    syncAnalyticsCohort(cohort);
  }, [cohort]);
  return null;
}
