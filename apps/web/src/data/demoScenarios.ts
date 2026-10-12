export interface DemoScenario {
  id: string;
  title: string;
  category: string;
  sourceMode: "mic" | "tab";
  targetLang: string;
  rawAudioDuration: string;
  rawSpeech: string;
  pipeline: {
    transcription: string;
    detectedLanguage: {
      primary: string;
      breakdown: string;
      confidence: number;
    };
    understanding: {
      meaning: string;
      intent: string;
      keyPoints: string[];
    };
    context: {
      audience: string;
      tone: string;
      formality: string;
      channel: string;
    };
    transformation: string;
  };
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "email-reply",
    title: "Executive Email",
    category: "Professional Email",
    sourceMode: "mic",
    targetLang: "English",
    rawAudioDuration: "0:08",
    rawSpeech: "Hey uh tell Sarah thanks for the q3 report and we loved the retention charts but can she double check slide eight numbers before tomorrow morning sync",
    pipeline: {
      transcription: "Hey uh tell Sarah thanks for the q3 report and we loved the retention charts but can she double check slide eight numbers before tomorrow morning sync",
      detectedLanguage: {
        primary: "English",
        breakdown: "100% English (Informal dictation)",
        confidence: 0.99
      },
      understanding: {
        meaning: "Praise for Q3 retention deck with an urgent request to verify slide 8 metrics prior to tomorrow's sync.",
        intent: "Express appreciation and request numerical verification.",
        keyPoints: ["Acknowledge Q3 report", "Approve retention metrics", "Request slide 8 audit before morning sync"]
      },
      context: {
        audience: "Colleague / Project Lead",
        tone: "Collaborative & Clear",
        formality: "Professional",
        channel: "Email"
      },
      transformation: "Hi Sarah,\n\nThanks for sending over the Q3 report—the retention metrics look fantastic. Could you please double-check the figures on Slide 8 ahead of our sync tomorrow morning?\n\nBest regards,"
    }
  },
  {
    id: "hinglish-chat",
    title: "Bilingual Hinglish",
    category: "Multilingual Messaging",
    sourceMode: "mic",
    targetLang: "Hinglish (Hindi + English)",
    rawAudioDuration: "0:09",
    rawSpeech: "Arey Rohit deployment complete ho gaya hai prod pe but ek baar staging cache clear karke verify kar lena so that clients ko koi issue na aaye",
    pipeline: {
      transcription: "Arey Rohit deployment complete ho gaya hai prod pe but ek baar staging cache clear karke verify kar lena so that clients ko koi issue na aaye",
      detectedLanguage: {
        primary: "Hinglish",
        breakdown: "Hindi (60%) + English (40%) Code-switching",
        confidence: 0.97
      },
      understanding: {
        meaning: "Prod deployment finished; recommends clearing staging cache and sanity testing to prevent client issues.",
        intent: "Deployment status update with follow-up verification task.",
        keyPoints: ["Prod deployment done", "Clear staging cache", "Verify to prevent client issues"]
      },
      context: {
        audience: "Engineering Team Member",
        tone: "Friendly & Pragmatic",
        formality: "Conversational Work Chat",
        channel: "Slack / Teams"
      },
      transformation: "Hey Rohit, production deployment wrap up ho gaya hai. Bas ek baar staging cache clear karke sanity check kar lena so clients face zero issues. Thanks!"
    }
  },
  {
    id: "tab-podcast",
    title: "Tab Audio Capture",
    category: "Browser-Tab Audio",
    sourceMode: "tab",
    targetLang: "English",
    rawAudioDuration: "0:14",
    rawSpeech: "[Tab Audio - YouTube Tech Talk] The core tradeoff with vector search isn't just query latency, it's index build time and memory footprint as corpus size scales into tens of millions.",
    pipeline: {
      transcription: "The core tradeoff with vector search isn't just query latency, it's index build time and memory footprint as corpus size scales into tens of millions.",
      detectedLanguage: {
        primary: "English",
        breakdown: "100% English (Technical presentation audio)",
        confidence: 0.99
      },
      understanding: {
        meaning: "Highlights vector search trade-offs centered on indexing time and memory overhead at high scale rather than simply latency.",
        intent: "Summarize technical architecture takeaway.",
        keyPoints: ["Query latency is not only factor", "Index construction time", "RAM overhead at 10M+ items"]
      },
      context: {
        audience: "Engineering Notes / Team Wiki",
        tone: "Analytical & Structured",
        formality: "Technical Summary",
        channel: "Notion / Doc"
      },
      transformation: "Key Takeaway: The primary constraint in vector search extends beyond query latency—index construction speed and RAM consumption become the dominant bottlenecks when scaling beyond tens of millions of documents."
    }
  },
  {
    id: "customer-feedback",
    title: "Customer Support Note",
    category: "Client Communication",
    sourceMode: "mic",
    targetLang: "Spanish (Español)",
    rawAudioDuration: "0:11",
    rawSpeech: "Hola please tell the user we resolved their billing webhook and refunded the duplicate charge from Sunday morning.",
    pipeline: {
      transcription: "Hola please tell the user we resolved their billing webhook and refunded the duplicate charge from Sunday morning.",
      detectedLanguage: {
        primary: "English / Spanish",
        breakdown: "Mixed conversational English with Spanish salutation",
        confidence: 0.96
      },
      understanding: {
        meaning: "Billing webhook fixed; duplicate fee refunded for Sunday incident.",
        intent: "Confirm issue resolution and customer refund.",
        keyPoints: ["Webhook fix confirmed", "Sunday duplicate charge refunded"]
      },
      context: {
        audience: "Client / Customer",
        tone: "Empathetic & Courteous",
        formality: "Customer Support",
        channel: "Zendesk / Intercom"
      },
      transformation: "Estimado cliente,\n\nLe confirmamos que el problema con el webhook de facturación ha sido resuelto y hemos procesado el reembolso del cargo duplicado del domingo por la mañana. Cualquier duda adicional, quedamos a su entera disposición."
    }
  }
];
