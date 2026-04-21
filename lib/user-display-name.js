function toTitleCase(value) {
    return value
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function getDisplayNameFromEmail(email, fallback = "Signed in user", preferredName = "") {
    const trimmedPreferredName = String(preferredName ?? "").trim();
    if (trimmedPreferredName) {
        return trimmedPreferredName;
    }
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const localPart = normalizedEmail.split("@")[0] ?? "";
    const normalizedLocalPart = localPart
        .replace(/[._+-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalizedLocalPart) {
        return fallback;
    }
    const derivedName = toTitleCase(normalizedLocalPart);
    return derivedName || fallback;
}
