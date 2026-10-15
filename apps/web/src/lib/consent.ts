/**
 * VoxFlow Cookie and Storage Consent Manager
 * Compliant with privacy regulations: Granular choices, non-essential tracking blocked by default,
 * persistent storage, and programmatic event notification.
 */

export interface CookieConsentCategories {
  essential: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

export interface CookieConsentRecord {
  version: string;
  timestamp: string;
  hasAnswered: boolean;
  categories: CookieConsentCategories;
}

export const CONSENT_STORAGE_KEY = "voxflow_cookie_consent_v1";
export const CONSENT_POLICY_VERSION = "1.0.0";

export const DEFAULT_CATEGORIES: CookieConsentCategories = {
  essential: true, // Always required for core application operations
  analytics: false,
  functional: false,
  marketing: false
};

/**
 * Retrieve currently saved consent preferences from localStorage.
 */
export function getStoredConsent(): CookieConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.categories) {
      return parsed as CookieConsentRecord;
    }
  } catch (err) {
    console.warn("Could not retrieve cookie consent preferences:", err);
  }
  return null;
}

/**
 * Save user consent decisions.
 */
export function saveConsent(
  categories: Partial<CookieConsentCategories>
): CookieConsentRecord {
  const record: CookieConsentRecord = {
    version: CONSENT_POLICY_VERSION,
    timestamp: new Date().toISOString(),
    hasAnswered: true,
    categories: {
      essential: true, // Non-negotiable essential storage
      analytics: Boolean(categories.analytics),
      functional: Boolean(categories.functional),
      marketing: Boolean(categories.marketing)
    }
  };

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(
      new CustomEvent("voxflow_consent_updated", { detail: record })
    );
  } catch (err) {
    console.error("Could not persist cookie consent:", err);
  }

  return record;
}

/**
 * Save "Accept All" consent.
 */
export function acceptAllConsent(): CookieConsentRecord {
  return saveConsent({
    essential: true,
    analytics: true,
    functional: true,
    marketing: true
  });
}

/**
 * Save "Reject Optional" consent (only essential storage enabled).
 */
export function rejectOptionalConsent(): CookieConsentRecord {
  return saveConsent({
    essential: true,
    analytics: false,
    functional: false,
    marketing: false
  });
}

/**
 * Check whether a specific category has active user consent.
 */
export function hasConsent(category: keyof CookieConsentCategories): boolean {
  if (category === "essential") return true;
  const stored = getStoredConsent();
  if (!stored || !stored.hasAnswered) return false;
  return Boolean(stored.categories[category]);
}

/**
 * Reset consent preferences (useful for testing or full withdrawal).
 */
export function resetConsent(): void {
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent("voxflow_consent_updated", { detail: null })
    );
  } catch (err) {
    console.warn("Could not reset cookie consent:", err);
  }
}
