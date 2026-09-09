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
  const modelName = "gemini-2.5-flash";
  const apiKey = getActiveApiKey();
  const keyLoaded = apiKey !== "";

  if (!keyLoaded) {
    return res.status(401).json({
      ok: false,
      modelUsed: modelName,
      keyLoaded: false,
      apiConnectivity: "Failed (API key missing)",
      error: "Gemini API key is not configured. Please add GEMINI_API_KEY in Vercel Environment Variables."
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

    const testResponse = await ai.models.generateContent({
      model: modelName,
      contents: "Hello! Reply with exactly 'Ready' in a single word with no punctuation.",
    });

    const textResult = testResponse.text?.trim() || "";

    return res.status(200).json({
      ok: true,
      modelUsed: modelName,
      keyLoaded: true,
      apiConnectivity: "Success",
      testRequestResult: textResult,
      startupStatus: "Gemini API Ready on Vercel",
      aiUploadOperational: "AI Upload is operational.",
      productionDeploymentReady: "Production deployment ready."
    });
  } catch (error: any) {
    const httpStatus = error?.status || error?.statusCode || 500;
    const errorMessage = error?.message || String(error);

    return res.status(httpStatus).json({
      ok: false,
      modelUsed: modelName,
      keyLoaded: true,
      apiConnectivity: "Failed",
      errorMessage: errorMessage
    });
  }
}
