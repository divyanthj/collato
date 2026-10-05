"use client";

import { useEffect, useRef } from "react";
import { trackDatafastGoal } from "@/lib/client-analytics";

export function ClientEventTracker({ goalName, metadata = null, oncePerSessionKey = "" }) {
  const trackedKeyRef = useRef("");
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const eventKey = oncePerSessionKey || goalName;
    if (trackedKeyRef.current === eventKey) return;
    if (oncePerSessionKey) {
      try {
        const storageKey = `collato-event:${oncePerSessionKey}`;
        if (window.sessionStorage.getItem(storageKey)) {
          return;
        }
      } catch {
        // Ignore storage failures and still attempt tracking.
      }
    }

    if (trackDatafastGoal(goalName, metadata)) {
      trackedKeyRef.current = eventKey;
      if (oncePerSessionKey) {
        try {
          window.sessionStorage.setItem(`collato-event:${oncePerSessionKey}`, "1");
        } catch {
          // The in-memory guard still prevents duplicate mount effects.
        }
      }
    }
  }, [goalName, metadata, oncePerSessionKey]);

  return null;
}
