import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

const envConfig = dotenv.config();
if (envConfig.parsed) {
  for (const key in envConfig.parsed) {
    if (envConfig.parsed[key]) {
      process.env[key] = envConfig.parsed[key];
    }
  }
}

const getActiveApiKey = (): string => {
  return (process.env.GEMINI_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { query } = req.body || {};
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter." });
  }

  const headerKey = req.headers["x-gemini-api-key"] || req.headers["X-Gemini-Api-Key"];
  const customKey = typeof headerKey === "string" ? headerKey.trim() : "";
  const apiKey = customKey || getActiveApiKey();

  if (apiKey === "") {
    return res.status(500).json({
      error: "AI is not configured. Please add GEMINI_API_KEY under Project Settings > Environment Variables."
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    let response: any = null;
    let geminiError: any = null;
    const modelsToTry = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-flash-latest"];
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const currentModel = modelsToTry[attempt - 1];
        response = await ai.models.generateContent({
          model: currentModel,
          contents: query,
          config: {
            systemInstruction: "You are a helpful assistant for 'AI TrackBook', a financial management app. The app allows users to create multiple books, add transactions (Cash In/Out), upload receipt images for AI detection (using AI TrackBook), and export reports in Excel/PDF. Users can also filter transactions by type, category, and duration. Answer the user's question about how to use the app or general financial advice within the context of this app. Keep it concise.",
          },
        });
        geminiError = null;
        break;
      } catch (err: any) {
        geminiError = err;
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    if (geminiError) {
      throw geminiError;
    }

    return res.status(200).json({ text: response?.text || "I'm sorry, I couldn't generate a response." });
  } catch (err: any) {
    console.error("[Vercel /api/gemini/ask] Error:", err);
    return res.status(500).json({ error: err.message || "An unexpected error occurred" });
  }
}
