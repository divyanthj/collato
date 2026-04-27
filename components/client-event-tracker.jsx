"use client";

import { useEffect } from "react";
import { trackDatafastGoal } from "@/lib/client-analytics";

export function ClientEventTracker({ goalName, metadata = null, oncePerSessionKey = "" }) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (oncePerSessionKey) {
      try {
        const storageKey = `collato-event:${oncePerSessionKey}`;
        if (window.sessionStorage.getItem(storageKey)) {
          return;
        }
        window.sessionStorage.setItem(storageKey, "1");
      } catch {
        // Ignore storage failures and still attempt tracking.
      }
    }

    trackDatafastGoal(goalName, metadata);
  }, [goalName, metadata, oncePerSessionKey]);

  return null;
}
