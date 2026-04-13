function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const sanitized = {};
  for (const [rawKey, rawValue] of Object.entries(metadata)) {
    const key = String(rawKey || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 64);

    if (!key) {
      continue;
    }

    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    sanitized[key] = String(rawValue).slice(0, 255);
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

export function trackDatafastGoal(goalName, metadata = null) {
  if (typeof window === "undefined") {
    return;
  }

  if (typeof window.datafast !== "function") {
    return;
  }

  const normalizedGoal = String(goalName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 64);

  if (!normalizedGoal) {
    return;
  }

  const sanitizedMetadata = sanitizeMetadata(metadata);

  try {
    if (sanitizedMetadata) {
      window.datafast(normalizedGoal, sanitizedMetadata);
      return;
    }
    window.datafast(normalizedGoal);
  } catch {
    // Ignore analytics failures to avoid blocking product actions.
  }
}

