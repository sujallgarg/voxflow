const insertButton =
  document.getElementById(
    "insert-button"
  ) as HTMLButtonElement;

const transcriptInput =
  document.getElementById(
    "transcript"
  ) as HTMLTextAreaElement;

const message =
  document.getElementById(
    "message"
  ) as HTMLParagraphElement;

const API_URL =
  "http://localhost:3001";

interface TransformResponse {
  finalText: string;
  targetLanguage: string;
  transformation: string;
}

interface InsertResponse {
  success: boolean;
  reason?: string;
}

insertButton.addEventListener(
  "click",
  async () => {
    const transcript =
      transcriptInput.value.trim();

    if (!transcript) {
      message.textContent =
        "Please enter something first.";

      return;
    }

    insertButton.disabled = true;

    message.textContent =
      "VoxFlow is transforming...";

    try {
      const response =
        await fetch(
          `${API_URL}/transform`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              transcript
            })
          }
        );

      if (!response.ok) {
        const error =
          await response.json().catch(
            () => null
          );

        throw new Error(
          error?.error ||
            `Transformation failed (${response.status})`
        );
      }

      const result =
        (await response.json()) as TransformResponse;

      if (!result.finalText) {
        throw new Error(
          "VoxFlow returned empty final text."
        );
      }

      message.textContent =
        "AI transformed. Inserting...";

      const insertResponse =
        (await chrome.runtime.sendMessage({
          type: "INSERT_TEXT",
          text: result.finalText
        })) as InsertResponse;

      if (!insertResponse?.success) {
        message.textContent =
          insertResponse?.reason ||
          "Unable to insert text.";

        return;
      }

      message.textContent =
        "Text inserted ✓";
    } catch (error) {
      console.error(
        "VoxFlow transformation error:",
        error
      );

      message.textContent =
        error instanceof Error
          ? error.message
          : "Something went wrong.";
    } finally {
      insertButton.disabled = false;
    }
  }
);