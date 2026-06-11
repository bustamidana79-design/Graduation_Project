function trimTrailingSlash(url: string) {
  return url.trim().replace(/\/+$/, "");
}

function isLocalUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function getClientAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";

  if (configuredUrl && (!isLocalUrl(configuredUrl) || isLocalUrl(browserOrigin))) {
    return trimTrailingSlash(configuredUrl);
  }

  return trimTrailingSlash(browserOrigin || configuredUrl);
}
