export function hasUnknownCitations(report) {
  const allowed = new Set((report.sources || []).map(source => source.ref));
  const text = JSON.stringify(Object.fromEntries(Object.entries(report).filter(([key]) => !["html", "workspaceSnapshot", "sources", "coverage"].includes(key))));
  return [...text.matchAll(/\[(S\d+|T\d+)\]/g)].some(match => !allowed.has(match[1])) || text.includes("[source unavailable]");
}

export function sanitizeReportCitations(content, sources) {
  const allowed = new Set(sources.map(source => source.ref));
  let unmatched = false;
  function clean(value) {
    if (typeof value === "string") return value.replace(/\[(S\d+|T\d+)\]/g, (match, ref) => { if (allowed.has(ref)) return match; unmatched = true; return "[source unavailable]"; });
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
    return value;
  }
  return { content: clean(content), unmatched };
}
