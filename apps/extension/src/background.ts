interface InsertRequest {
  type: "INSERT_TEXT";
  text: string;
}

function isRestrictedUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("devtools://") ||
    url.startsWith("view-source:") ||
    url.includes("chrome.google.com/webstore") ||
    url.includes("chromewebstore.google.com")
  );
}

chrome.runtime.onMessage.addListener(
  (
    message: InsertRequest,
    _sender,
    sendResponse
  ) => {
    if (message.type !== "INSERT_TEXT") {
      return;
    }

    (async () => {
      try {
        let tabs =
          await chrome.tabs.query({
            active: true,
            currentWindow: true
          });

        if (!tabs.length) {
          tabs =
            await chrome.tabs.query({
              active: true,
              lastFocusedWindow: true
            });
        }

        const activeTab = tabs[0];

        if (!activeTab?.id) {
          sendResponse({
            success: false,
            reason: "No active tab found."
          });

          return;
        }

        if (isRestrictedUrl(activeTab.url)) {
          sendResponse({
            success: false,
            reason:
              "Cannot insert text on restricted browser pages."
          });

          return;
        }

        let response;

        try {
          response =
            await chrome.tabs.sendMessage(
              activeTab.id,
              message
            );
        } catch {
          // If content script is not yet available, inject content.js and retry
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ["content.js"]
          });

          response =
            await chrome.tabs.sendMessage(
              activeTab.id,
              message
            );
        }

        sendResponse(response);
      } catch (error) {
        console.error(
          "VoxFlow insertion error:",
          error
        );

        sendResponse({
          success: false,
          reason:
            "Could not communicate with the active page."
        });
      }
    })();

    return true;
  }
);