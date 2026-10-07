const grantBtn =
  document.getElementById(
    "grant-btn"
  ) as HTMLButtonElement;

const msgEl =
  document.getElementById(
    "msg"
  ) as HTMLDivElement;

async function requestPermission() {
  grantBtn.disabled = true;
  msgEl.textContent =
    "Requesting microphone access...";
  msgEl.style.color = "#a1a1aa";

  try {
    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });

    stream.getTracks().forEach((track) => {
      track.stop();
    });

    msgEl.textContent =
      "✓ Microphone access granted! Closing...";
    msgEl.style.color = "#34d399";

    setTimeout(() => {
      window.close();
    }, 1200);
  } catch (error: unknown) {
    console.error(
      "Microphone permission error:",
      error
    );

    grantBtn.disabled = false;

    const err = error as {
      name?: string;
      message?: string;
    };

    if (err?.name === "NotAllowedError") {
      msgEl.textContent =
        "Permission was denied. Please allow microphone access and click again.";
      msgEl.style.color = "#ef4444";
    } else {
      msgEl.textContent =
        err?.message ||
        "Could not access microphone.";
      msgEl.style.color = "#ef4444";
    }
  }
}

grantBtn.addEventListener(
  "click",
  requestPermission
);

// Trigger permission request on load so Chrome prompts right away
requestPermission();
