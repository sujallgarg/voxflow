import "dotenv/config";
import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error(
    "GROQ_API_KEY is missing. Add it to apps/api/.env"
  );
}

const groq = new Groq({
  apiKey
});

export interface TransformationInput {
  transcript: string;
  meaning?: string;
  intent?: string;
  audience?: string;
  communicationType?: string;
  tone?: string;
  formality?: string;
  likelyChannel?: string;
  purpose?: string;
  targetLanguage?: string;
}

export interface TransformationResult {
  finalText: string;
  targetLanguage: string;
  transformation: string;
}

export async function transformTranscript(
  input: TransformationInput
): Promise<TransformationResult> {
  const response =
    await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",

      temperature: 0.2,

      response_format: {
        type: "json_object"
      },

      messages: [
        {
          role: "system",

          content: `
You are VoxFlow's final communication engine.

Your job is to convert the user's spoken input
into the exact message the user intends to send.

The user may speak naturally and may mix
multiple languages.

Your highest priorities are:

1. Preserve the user's intent.
2. Preserve all factual information.
3. Preserve important details.
4. Use the requested target language.
5. Adapt the tone to the communication context.
6. Remove unnecessary speech fillers.
7. Produce natural written communication.

IMPORTANT:

Do NOT invent information.

Do NOT add facts.

Do NOT remove important information.

Do NOT change names.

Do NOT change dates.

Do NOT change times.

Do NOT change numbers.

Do NOT change prices.

Do NOT change locations.

Do NOT change the user's intended meaning.

Do NOT answer the user directly.

You are creating the message that the user
wants to send to another person.

For example:

User transcript:
"Client ko bol dena ki meeting morgen um zehn Uhr hai
and ask him to confirm."

Meaning:
"Tell the client that the meeting is tomorrow
at 10 AM and ask him to confirm."

Audience:
client

Tone:
professional

Purpose:
meeting confirmation

Good output:
"The meeting is scheduled for tomorrow at 10:00 AM.
Please confirm if that time works for you."

Bad output:
"Sure, I can help you tell the client."

Bad output:
"The client should confirm the meeting."

Bad output:
"Tomorrow at 10 AM meeting."

The finalText must be the actual message
the user can send.

LANGUAGE RULES:

If targetLanguage is provided:

- ALWAYS write finalText in that language.
- Translate the user's intended meaning into that language.
- Do not return the original language unless
  the target language is the same.
- Preserve all important facts and details.

If targetLanguage is "Auto":

- Determine the most appropriate output language
  from the available context.
- If the recipient language is unknown,
  use the most appropriate language based
  on the communication context.
- Do not unnecessarily translate the message.

STYLE RULES:

Write like a real human.

Match the requested tone.

For professional communication:
be clear, concise and natural.

For casual communication:
sound natural and conversational.

For business communication:
be professional but not robotic.

Do not mention VoxFlow.

Do not explain your reasoning.

Do not provide multiple versions.

Do not add quotation marks around finalText.

Return exactly ONE final message.

IMPORTANT:

Your response MUST be valid json.

Return ONLY valid json.

Use exactly this JSON structure:

{
  "finalText": "The actual message the user can send.",
  "targetLanguage": "English",
  "transformation": "Professional business message"
}
`
        },

        {
          role: "user",

          content: JSON.stringify({
            transcript: input.transcript,
            meaning: input.meaning,
            intent: input.intent,
            audience: input.audience,
            communicationType:
              input.communicationType,
            tone: input.tone,
            formality: input.formality,
            likelyChannel:
              input.likelyChannel,
            purpose: input.purpose,
            targetLanguage:
              input.targetLanguage ?? "Auto"
          })
        }
      ]
    });

  const content =
    response.choices[0]?.message?.content;

  if (!content) {
    throw new Error(
      "Groq returned an empty transformation response."
    );
  }

  let result: {
    finalText?: string;
    targetLanguage?: string;
    transformation?: string;
  };

  try {
    result = JSON.parse(content);
  } catch {
    throw new Error(
      "Groq returned invalid json."
    );
  }

  if (!result.finalText) {
    throw new Error(
      "Transformation response is missing finalText."
    );
  }

  return {
    finalText: result.finalText,
    targetLanguage:
      result.targetLanguage ||
      input.targetLanguage ||
      "Unknown",
    transformation:
      result.transformation ||
      "AI communication transformation"
  };
}