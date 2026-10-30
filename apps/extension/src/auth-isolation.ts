/**
 * Origin and Sender Verification for VoxFlow Chrome Extension
 * Ensures credentials can only be synchronized with official VoxFlow web applications.
 */

export function isTrustedVoxFlowOrigin(urlOrOrigin?: string): boolean {
  if (!urlOrOrigin) return false;
  try {
    const parsed = new URL(urlOrOrigin);
    const origin = parsed.origin.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();

    // Strict exact matches for local development
    if (
      origin === "http://localhost:5173" ||
      origin === "http://127.0.0.1:5173" ||
      origin === "http://localhost:3000"
    ) {
      return true;
    }

    // Strict exact matches for production web app
    if (
      origin === "https://voxflow.com" ||
      origin === "https://www.voxflow.com" ||
      origin === "https://voxflow-web.onrender.com" ||
      origin === "https://voxflow-one.vercel.app"
    ) {
      return true;
    }

    // Must be official voxflow.com domain or subdomain with HTTPS
    if (hostname === "voxflow.com" || hostname.endsWith(".voxflow.com")) {
      return parsed.protocol === "https:";
    }

    // Official production and preview Vercel domains
    if (
      hostname === "voxflow-one.vercel.app" ||
      (/^voxflow(-[a-z0-9_-]+)?\.vercel\.app$/i.test(hostname))
    ) {
      return parsed.protocol === "https:";
    }

    return false;
  } catch {
    return false;
  }
}

export function isTrustedAuthSender(
  sender: { id?: string; url?: string; tab?: unknown },
  extensionId?: string
): boolean {
  // Extension internal contexts (popup, options, offscreen) have matching sender.id and NO tab
  if (!sender.tab && extensionId && sender.id === extensionId) {
    return true;
  }
  // Messages from extension URLs
  if (sender.url && extensionId && sender.url.startsWith(`chrome-extension://${extensionId}`)) {
    return true;
  }
  // Messages from web tabs must have a verified URL from trusted VoxFlow origins
  if (sender.url) {
    return isTrustedVoxFlowOrigin(sender.url);
  }
  return false;
}
