import { GoogleGenAI, Type } from "@google/genai";
import { NicheAnalysis, StrategyPlan, VideoConcept, StoryboardScene } from "./types";

/**
 * Enhanced retry logic with jittered exponential backoff.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 1500): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) throw error;
    
    const status = error?.status || 0;
    const message = error?.message?.toLowerCase() || "";
    
    // Specifically handle 429 (Rate Limit) with longer pauses
    const isRateLimit = status === 429 || message.includes("429") || message.includes("quota");
    const delay = isRateLimit ? baseDelay * 3 : baseDelay;
    
    // Jittered delay to prevent thundering herd
    const jitter = Math.random() * 500;
    const finalDelay = delay + jitter;

    console.warn(`API Error: ${message}. Retrying in ${Math.round(finalDelay)}ms... (Attempts left: ${retries})`);
    
    await new Promise(resolve => setTimeout(resolve, finalDelay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

/**
 * Robust JSON extraction from AI responses.
 * Handles markdown blocks, leading/trailing text, and multiple JSON fragments.
 */
function selfHealJson(text: string): any {
  if (!text) return null;
  
  const clean = text.trim();
  
  try {
    return JSON.parse(clean);
  } catch (e) {
    // Attempt to find the largest JSON-like structure (object or array)
    const jsonRegex = /({[\s\S]*}|\[[\s\S]*\])/;
    const match = clean.match(jsonRegex);
    
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (innerE) {
        // Last ditch effort: replace common AI artifacts
        const sanitized = match[0]
          .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
          .replace(/([{,]\s*)([a-zA-Z0-9_]+):/g, '$1"$2":'); // quote keys
        try {
          return JSON.parse(sanitized);
        } catch (finalE) {
          console.error("JSON Self-healing failed completely on block:", match[0]);
        }
      }
    }
  }
  throw new Error("Invalid response format from Intelligence Engine.");
}

const SYSTEM_INSTRUCTION = `You are ContentForge AI — an expert digital marketing strategist for faceless channels. 
Your mission is to help users build, manage, and monetize automated content channels across YouTube and Facebook.
Focus on high-retention storytelling, psychological hooks, and actionable growth steps.
Strictly adhere to the requested JSON schema. Do not include preamble or conversational filler.`;

export async function analyzeNiche(niche: string): Promise<NicheAnalysis> {
  return withRetry(async () => {
    // Correctly initialize GoogleGenAI with direct API key access per instance
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Perform a comprehensive market analysis for the "${niche}" faceless content niche.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            trendScore: { type: Type.NUMBER, description: "1-10 scale" },
            competition: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
            monetization: { type: Type.STRING },
            longevity: { type: Type.STRING },
            platformFit: { type: Type.STRING },
          },
          required: ["name", "trendScore", "competition", "monetization", "longevity", "platformFit"],
        },
      },
    });
    const data = selfHealJson(response.text);
    // Logical Parameter Guard: Ensure trendScore is normalized
    if (data) data.trendScore = Math.min(10, Math.max(0, data.trendScore));
    return data;
  });
}

export async function generateStrategy(niche: string, platform: string): Promise<StrategyPlan> {
  return withRetry(async () => {
    // Correctly initialize GoogleGenAI with direct API key access per instance
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Develop a tactical 90-day roadmap for a ${niche} channel targeting ${platform}.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weeks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  range: { type: Type.STRING },
                  phase: { type: Type.STRING },
                  focus: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["range", "phase", "focus"],
              },
            },
          },
          required: ["weeks"],
        },
      },
    });
    return selfHealJson(response.text);
  });
}

export async function generateVideoConcepts(niche: string): Promise<VideoConcept[]> {
  return withRetry(async () => {
    // Correctly initialize GoogleGenAI with direct API key access per instance
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Engineered 5 viral faceless video concepts for: ${niche}.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              hook: { type: Type.STRING },
              structure: { type: Type.STRING },
              visualDirection: { type: Type.STRING },
              seo: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["description", "tags"]
              }
            },
            required: ["title", "hook", "structure", "visualDirection", "seo"]
          }
        },
      },
    });
    return selfHealJson(response.text);
  });
}

export async function generateScript(concept: VideoConcept): Promise<string> {
  return withRetry(async () => {
    // Correctly initialize GoogleGenAI with direct API key access per instance
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Script Request: "${concept.title}". Format: Narrative-style, high-retention, includes [visual cues]. Context: ${concept.structure}.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        // Pro model with thinking budget for higher quality creative writing
        thinkingConfig: { thinkingBudget: 4000 }
      },
    });
    return response.text || "Failed to produce script content.";
  });
}

export async function splitScriptIntoStoryboard(script: string): Promise<StoryboardScene[]> {
  return withRetry(async () => {
    // Correctly initialize GoogleGenAI with direct API key access per instance
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Sequence the following script into visual storyboard scenes:\n\n${script}`,
      config: {
        systemInstruction: "You are a lead storyboard director. Break down scripts into high-impact visual segments.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              visualPrompt: { type: Type.STRING },
              duration: { type: Type.NUMBER },
            },
            required: ["id", "text", "visualPrompt", "duration"],
          },
        },
      },
    });
    return selfHealJson(response.text);
  });
}

export async function generateImageForScene(visualPrompt: string): Promise<string> {
  return withRetry(async () => {
    // Correctly initialize GoogleGenAI with direct API key access per instance
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Professional, cinematic b-roll footage frame: ${visualPrompt}. Faceless stock style, 4k, hyper-realistic, bokeh background.` }],
      },
      config: {
        imageConfig: { aspectRatio: "16:9" },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Image Buffer Empty.");
  });
}