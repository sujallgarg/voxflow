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

function checkAndSyncVoxFlowAuth() {
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
            if (parsed?.access_token) {
              token = parsed.access_token;
            }
            if (parsed?.user?.id) {
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
        if (parsed?.id && parsed.id !== "user_me") {
          userId = parsed.id;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (token || userId) {
      chrome.runtime.sendMessage({
        type: "SYNC_AUTH",
        token: token || undefined,
        userId: userId || undefined
      }).catch(() => {});
    } else {
      chrome.runtime.sendMessage({
        type: "CLEAR_AUTH"
      }).catch(() => {});
    }
  } catch {
    // Cross-origin or restricted frame security ignore
  }
}

if (window.location.hostname === "localhost" || window.location.hostname.includes("voxflow")) {
  checkAndSyncVoxFlowAuth();

  window.addEventListener("storage", (e) => {
    if (e.key === "voxflow_current_user" || (e.key && e.key.startsWith("sb-"))) {
      checkAndSyncVoxFlowAuth();
    }
  });

  window.addEventListener("voxflow_auth_sync", () => {
    checkAndSyncVoxFlowAuth();
  });
}