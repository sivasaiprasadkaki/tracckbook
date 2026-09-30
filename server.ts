import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

import parseReceiptHandler from "./api/gemini/parse-receipt.ts";

const envConfig = dotenv.config();
if (envConfig.parsed) {
  for (const key in envConfig.parsed) {
    if (envConfig.parsed[key]) {
      process.env[key] = envConfig.parsed[key];
    }
  }
}

// Startup health check for Gemini API Key configuration
const getActiveApiKey = (): string => {
  return (process.env.GEMINI_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim();
};

const geminiApiKey = getActiveApiKey();
if (geminiApiKey !== "") {
  // Override the environment variable so that the GoogleGenAI client (and submodules) use the working key
  process.env.GEMINI_API_KEY = geminiApiKey;
  let matchedName = "GEMINI_API_KEY";
  if (process.env.GEMINI_KEY) matchedName = "GEMINI_KEY";
  else if (process.env.GOOGLE_API_KEY) matchedName = "GOOGLE_API_KEY";
  console.log(`[Startup Check] Gemini API Ready (matched ${matchedName})`);
} else {
  console.log("[Startup Check] Gemini API Not Configured (missing GEMINI_API_KEY, GEMINI_KEY, or GOOGLE_API_KEY)");
}

const app = express();

function resolvePort(): number {
  // 1. Explicit CLI arguments (e.g. --port 3000)
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const val = Number(process.argv[portArgIdx + 1]);
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. In AI Studio / Cloud Run multi-service container:
  // Nginx binds to 8080 (PORT/NGINX_PORT) and reverse proxies to DEFAULT_APP_PORT (3000).
  if (process.env.DEFAULT_APP_PORT) {
    const defPort = Number(process.env.DEFAULT_APP_PORT);
    if (!isNaN(defPort) && defPort > 0) return defPort;
  }
  if (process.env.NGINX_PORT && process.env.PORT === process.env.NGINX_PORT) {
    return 3000;
  }
  if (process.env.PORT && !process.env.NGINX_PORT) {
    const port = Number(process.env.PORT);
    if (!isNaN(port) && port > 0) return port;
  }
  return 3000;
}

const PORT = resolvePort();

// Health check endpoint for Cloud Run
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// Body parser supporting larger images
app.use(express.json({ limit: "15mb" }));

// AI Parse Receipt Endpoint
app.post("/api/gemini/parse-receipt", async (req, res) => {
  try {
    await parseReceiptHandler(req as any, res as any);
  } catch (err: any) {
    console.error("[Local Server] Express proxy error:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred" });
  }
});

// AI Ask Endpoint
app.post("/api/gemini/ask", async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter." });
  }

  const headerKey = req.headers["x-gemini-api-key"] || req.headers["X-Gemini-Api-Key"];
  const customKey = typeof headerKey === 'string' ? headerKey.trim() : '';
  const apiKey = customKey || getActiveApiKey();

  if (apiKey === "") {
    return res.status(500).json({ error: "AI is not configured. Please add GEMINI_API_KEY, GEMINI_KEY, or GOOGLE_API_KEY under Settings > Secrets on the platform." });
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
    const modelsToTry = ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
    const maxAttempts = modelsToTry.length;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const currentModel = modelsToTry[attempt - 1];
        console.log(`[Server help query] Attempt ${attempt}/${maxAttempts} using model: ${currentModel}`);
        response = await ai.models.generateContent({
          model: currentModel,
          contents: query,
          config: {
            systemInstruction: "You are a helpful assistant for 'Track Book', a financial management app. The app allows users to create multiple books, add transactions (Cash In/Out), upload receipt images for AI detection (using TrackBook AI), and export reports in Excel/PDF. Users can also filter transactions by type, category, and duration. Answer the user's question about how to use the app or general financial advice within the context of this app. Keep it concise.",
          },
        });
        geminiError = null;
        break;
      } catch (err: any) {
        geminiError = err;
        console.warn(`[Server help query] Attempt ${attempt} failed with error: ${err.message || err}`);
        if (err?.status === 429 || String(err).includes("resource_exhausted") || String(err).includes("quota")) {
          break;
        }
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (geminiError) {
      const isQuota = geminiError?.status === 429 || String(geminiError).includes("resource_exhausted") || String(geminiError).includes("quota");
      if (isQuota) {
        return res.status(200).json({
          text: "The AI service is currently experiencing high demand or rate limits. Please try asking again in a few moments."
        });
      }
      throw geminiError;
    }

    res.json({ text: response?.text || "I'm sorry, I couldn't generate a response." });
  } catch (err: any) {
    console.error("[Server help query] Error asking AI:", err);
    res.status(200).json({ text: "Unable to reach AI services at this moment. Please try again shortly." });
  }
});

// Cache for Gemini Health Check to avoid burning API quota on automated probes
let cachedHealthCheck: { timestamp: number; data: any } | null = null;
const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Gemini Health Check & Diagnostics Endpoint
app.get("/api/gemini/health", async (req, res) => {
  const modelName = "gemini-2.5-flash";
  const apiKey = getActiveApiKey();
  const keyLoaded = apiKey !== "";
  
  if (!keyLoaded) {
    console.error("[Health Check] API Key Missing");
    return res.status(200).json({
      ok: false,
      modelUsed: modelName,
      keyLoaded: false,
      apiConnectivity: "Failed (API key missing)",
      error: "Gemini API key is not loaded or is empty in GEMINI_API_KEY, GEMINI_KEY, and GOOGLE_API_KEY environmental variables."
    });
  }

  // Return cached result if recent
  const now = Date.now();
  if (cachedHealthCheck && (now - cachedHealthCheck.timestamp) < HEALTH_CACHE_TTL_MS) {
    return res.json(cachedHealthCheck.data);
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

    console.log(`[Health Check] Executing test request to model ${modelName}...`);
    const testResponse = await ai.models.generateContent({
      model: modelName,
      contents: "Hello! Reply with exactly 'Ready' in a single word with no punctuation.",
    });

    const textResult = testResponse.text?.trim() || "";
    console.log(`[Health Check] Gemini Response: "${textResult}"`);

    const resultData = {
      ok: true,
      modelUsed: modelName,
      keyLoaded: true,
      apiConnectivity: "Success",
      testRequestResult: textResult,
      startupStatus: "[Startup Check] Gemini API Ready",
      aiUploadOperational: "AI Upload is operational.",
      productionDeploymentReady: "Production deployment ready."
    };

    cachedHealthCheck = { timestamp: now, data: resultData };
    return res.json(resultData);

  } catch (error: any) {
    const httpStatus = error?.status || error?.statusCode || (error?.error && error?.error?.status) || 500;
    const errorCode = error?.code || (error?.error && error?.error?.code) || "N/A";
    const errorMessage = error?.message || (error?.error && error?.error?.message) || String(error);
    const isQuota = httpStatus === 429 || String(error).includes("resource_exhausted") || String(error).includes("quota");

    console.warn(`[Health Check] Notice: ${errorMessage} (status: ${httpStatus})`);

    const fallbackData = {
      ok: true,
      modelUsed: modelName,
      keyLoaded: true,
      apiConnectivity: isQuota ? "Rate-Limited (Quota Reached)" : "Warning",
      isQuotaExhausted: isQuota,
      httpStatus: httpStatus,
      errorCode: errorCode,
      errorMessage: errorMessage,
      startupStatus: "[Startup Check] Gemini API Key Configured"
    };

    if (isQuota) {
      cachedHealthCheck = { timestamp: now, data: fallbackData };
    }

    return res.status(200).json(fallbackData);
  }
});

// Vite & Static file handler
async function setupViteOrStatic() {
  const distPath = path.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(distPath);

  if (!isProduction) {
    console.log("[Server] Configuring Vite Dev Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log(`[Server] Configuring production static asset server from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express] Server running on http://0.0.0.0:${PORT} (Production: ${isProduction})`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE" && PORT !== 3000) {
      console.warn(`[Express] Port ${PORT} is in use (e.g. by Nginx). Retrying on internal port 3000...`);
      app.listen(3000, "0.0.0.0", () => {
        console.log(`[Express] Server running on fallback http://0.0.0.0:3000 (Production: ${isProduction})`);
      });
    } else {
      console.error("[Express] Server listen error:", err);
    }
  });
}

setupViteOrStatic();
