export function normalizeUsername(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const username = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return /^[\p{L}\p{N}._-]{2,64}$/u.test(username) ? username : "";
}

export function parsePastedUsername(value) {
  const direct = normalizeUsername(value);
  return direct || usernameFromProfileUrl(typeof value === "string" ? value.trim() : "");
}

function usernameFromProfileUrl(value) {
  if (!/^https:\/\//i.test(value)) return "";
  try {
    const url = new URL(value);
    if (!["locket.camera", "www.locket.camera", "locket.cam", "www.locket.cam"].includes(url.hostname.toLowerCase())) return "";
    const fromQuery = url.searchParams.get("username") || url.searchParams.get("user");
    if (fromQuery) return normalizeUsername(fromQuery);
    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length || parts.some((part) => ["links", "share", "story", "stories"].includes(part.toLowerCase()))) return "";
    const last = decodeURIComponent(parts.at(-1)).replace(/^@/, "");
    return /^[\p{L}\p{N}._-]{2,64}$/u.test(last) ? last : "";
  } catch { return ""; }
}
