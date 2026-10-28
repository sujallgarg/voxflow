interface InsertMessage {
  type: "INSERT_TEXT";
  text: string;
}

let lastFocusedElement:
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLElement
  | null = null;

function isSupportedElement(
  element: unknown
): element is HTMLInputElement | HTMLTextAreaElement | HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element.isContentEditable
  );
}

function updateLastFocused(element: unknown) {
  if (isSupportedElement(element)) {
    lastFocusedElement = element;
  }
}

if (isSupportedElement(document.activeElement)) {
  lastFocusedElement = document.activeElement;
}

document.addEventListener(
  "focusin",
  (event) => {
    updateLastFocused(event.target);
  },
  true
);

document.addEventListener(
  "focus",
  (event) => {
    updateLastFocused(event.target);
  },
  true
);

document.addEventListener(
  "click",
  (event) => {
    updateLastFocused(event.target);
  },
  true
);

document.addEventListener(
  "pointerdown",
  (event) => {
    updateLastFocused(event.target);
  },
  true
);

function insertIntoInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string
) {
  element.focus();

  const start =
    element.selectionStart ?? element.value.length;

  const end =
    element.selectionEnd ?? element.value.length;

  const currentValue = element.value;

  const newValue =
    currentValue.slice(0, start) +
    text +
    currentValue.slice(end);

  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

  const valueSetter =
    Object.getOwnPropertyDescriptor(
      prototype,
      "value"
    )?.set;

  valueSetter?.call(element, newValue);

  const cursorPosition =
    start + text.length;

  element.setSelectionRange(
    cursorPosition,
    cursorPosition
  );

  element.dispatchEvent(
    new Event("input", {
      bubbles: true
    })
  );

  element.dispatchEvent(
    new Event("change", {
      bubbles: true
    })
  );
}

function insertIntoContentEditable(
  element: HTMLElement,
  text: string
) {
  element.focus();

  const selection =
    window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    element.textContent =
      `${element.textContent ?? ""}${text}`;

    return;
  }

  const range =
    selection.getRangeAt(0);

  if (
    !element.contains(
      range.commonAncestorContainer
    )
  ) {
    element.textContent =
      `${element.textContent ?? ""}${text}`;

    return;
  }

  range.deleteContents();

  const textNode =
    document.createTextNode(text);

  range.insertNode(textNode);

  range.setStartAfter(textNode);
  range.collapse(true);

  selection.removeAllRanges();
  selection.addRange(range);

  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text
    })
  );
}

function insertText(text: string) {
  const element =
    (isSupportedElement(document.activeElement)
      ? document.activeElement
      : null) ?? lastFocusedElement;

  if (!element) {
    return {
      success: false,
      reason:
        "No text field has been focused."
    };
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    insertIntoInput(element, text);

    return {
      success: true
    };
  }

  if (
    element instanceof HTMLElement &&
    element.isContentEditable
  ) {
    insertIntoContentEditable(
      element,
      text
    );

    return {
      success: true
    };
  }

  return {
    success: false,
    reason:
      "Active element is not a supported text field."
  };
}

chrome.runtime.onMessage.addListener(
  (
    message: InsertMessage,
    sender,
    sendResponse
  ) => {
    // Security: Only process messages originating from this extension's background worker
    if (sender.id && sender.id !== chrome.runtime.id) {
      return;
    }

    if (message.type !== "INSERT_TEXT") {
      return;
    }

    const result =
      insertText(message.text);

    sendResponse(result);
  }
);

console.log("VoxFlow content script loaded.");

function isTrustedVoxFlowWebOrigin(): boolean {
  try {
    const origin = window.location.origin.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();

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
      origin === "https://voxflow-web.onrender.com"
    ) {
      return true;
    }

    // Must be official voxflow.com domain or subdomain with HTTPS
    if (hostname === "voxflow.com" || hostname.endsWith(".voxflow.com")) {
      return window.location.protocol === "https:";
    }

    return false;
  } catch {
    return false;
  }
}

function checkAndSyncVoxFlowAuth() {
  // CRITICAL: Never inspect localStorage or dispatch sync messages on third-party sites!
  if (!isTrustedVoxFlowWebOrigin()) {
    return;
  }

  try {
    let token: string | null = null;
    let userId: string | null = null;

    // 1. Check for Supabase auth token in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.access_token && typeof parsed.access_token === "string") {
              token = parsed.access_token;
            }
            if (parsed?.user?.id && typeof parsed.user.id === "string") {
              userId = parsed.user.id;
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    }

    // 2. Check for current user profile in localStorage
    const rawUser = localStorage.getItem("voxflow_current_user");
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        if (parsed?.id && typeof parsed.id === "string" && parsed.id !== "user_me") {
          userId = parsed.id;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Synchronize authenticated session when available
    if (token || userId) {
      chrome.runtime.sendMessage({
        type: "SYNC_AUTH",
        token: token || undefined,
        userId: userId || undefined
      }).catch(() => {});
    }
    // CRITICAL: NEVER dispatch CLEAR_AUTH on initial load or simply because the page has no token!
    // Visiting an unauthenticated page or landing page must NOT wipe an active extension session!
  } catch {
    // Cross-origin or restricted frame security ignore
  }
}

function handleExplicitSignOut() {
  if (!isTrustedVoxFlowWebOrigin()) {
    return;
  }
  chrome.runtime.sendMessage({
    type: "CLEAR_AUTH"
  }).catch(() => {});
}

// Only register auth listeners when running on a verified, trusted VoxFlow web origin
if (isTrustedVoxFlowWebOrigin()) {
  checkAndSyncVoxFlowAuth();

  window.addEventListener("storage", (e) => {
    if (e.key === "voxflow_current_user" || (e.key && e.key.startsWith("sb-"))) {
      if (e.newValue === null) {
        handleExplicitSignOut();
      } else {
        checkAndSyncVoxFlowAuth();
      }
    }
  });

  window.addEventListener("voxflow_auth_sync", () => {
    checkAndSyncVoxFlowAuth();
  });

  window.addEventListener("voxflow_user_signed_out", () => {
    handleExplicitSignOut();
  });
}