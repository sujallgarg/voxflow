/**
 * VoxFlow Extension Configuration
 *
 * Centralized configuration for Chrome Web Store listing, download links,
 * and extension metadata.
 */

// Official Chrome Web Store URL (configurable via VITE_CHROME_EXTENSION_URL)
export const CHROME_EXTENSION_STORE_URL: string =
  (import.meta.env.VITE_CHROME_EXTENSION_URL as string | undefined)?.trim() || "";

export const EXTENSION_NAME = "VoxFlow Voice Typing & Meeting Companion";
export const EXTENSION_VERSION = "0.1.0";

/**
 * Returns true if a valid, published Chrome Web Store URL is configured.
 */
export function isExtensionStoreAvailable(): boolean {
  if (!CHROME_EXTENSION_STORE_URL) {
    return false;
  }
  try {
    const url = new URL(CHROME_EXTENSION_STORE_URL);
    return (
      url.protocol === "https:" &&
      (url.hostname.includes("chrome.google.com") || url.hostname.includes("chromewebstore.google.com"))
    );
  } catch {
    return false;
  }
}

/**
 * Directs the user to the Chrome Web Store listing if published.
 * If not yet published, invokes the fallback callback (e.g. to display the coming-soon dialog).
 */
export function openExtensionStore(onUnavailable?: () => void): void {
  if (isExtensionStoreAvailable()) {
    window.open(CHROME_EXTENSION_STORE_URL, "_blank", "noopener,noreferrer");
  } else {
    onUnavailable?.();
  }
}
