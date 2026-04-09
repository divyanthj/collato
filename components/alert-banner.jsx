function getToneClasses(tone) {
  if (tone === "success") {
    return "border border-success/40 bg-success/10 text-success";
  }

  return "border border-error/40 bg-error/10 text-error";
}

function AlertIcon({ tone }) {
  if (tone === "success") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-5 w-5 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-5 w-5 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

export function AlertBanner({ tone = "error", className = "", children }) {
  const classes = ["alert", "items-start", "rounded-2xl", "text-sm", "shadow-sm", getToneClasses(tone), className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <AlertIcon tone={tone} />
      <div className="min-w-0 flex-1 leading-6">{children}</div>
    </div>
  );
}
