import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { NicheAnalysis, StrategyPlan, VideoConcept, StoryboardScene, GroundingSource } from "./types";

/**
 * Enhanced retry logic with exponential backoff and jitter for rate-limited requests.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 3000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const status = error?.status || 0;
    const message = error?.message?.toLowerCase() || "";
    const isBusy = status === 429 || message.includes("429") || message.includes("quota") || message.includes("resource_exhausted");
    
    if (isBusy && retries > 0) {
      const delay = baseDelay * (4 - retries);
      const jitter = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
      return withRetry(fn, retries - 1, baseDelay);
    }

    if (isBusy) {
      throw new Error("AI Capacity Reached. Please wait 60 seconds for the node to cool down.");
    }
    throw error;
  }
}

/**
 * Standardized system instruction for the AI agent.
 */
const SYSTEM_INSTRUCTION = `You are ContentForge AI — the world's most advanced digital marketing strategist and viral content engineer.
Your specialty is the 'Faceless Empire' framework: creating high-CPM, high-retention channels without showing a face.
Output MUST be strict JSON matching the provided schema. No markdown wrapping, no chatter.
Focus on psychological triggers, engagement hooks, and SEO optimization.`;

/**
 * Extracts grounding chunks from the response metadata.
 */
function extractSources(response: GenerateContentResponse): GroundingSource[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks
    .filter((chunk: any) => chunk.web)
    .map((chunk: any) => ({
      title: chunk.web.title || "Reference",
      uri: chunk.web.uri
    }));
}

/**
 * Analyzes a niche using real-time search grounding.
 */
export async function analyzeNiche(niche: string): Promise<NicheAnalysis> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Execute deep market intelligence report for: ${niche}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            trendScore: { type: Type.NUMBER, description: "Market heat (0-10)" },
            competition: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
            monetization: { type: Type.STRING, description: "Primary revenue path" },
            longevity: { type: Type.STRING, description: "Projected market life" },
            platformFit: { type: Type.STRING, description: "Primary platform recommendation" },
          },
          required: ["name", "trendScore", "competition", "monetization", "longevity", "platformFit"],
        },
      },
    });
    const result = JSON.parse(response.text || "{}");
    result.sources = extractSources(response);
    return result;
  });
}

/**
 * Generates a retention-engineered script using Thinking Config for deep reasoning.
 */
export async function generateScript(concept: VideoConcept): Promise<string> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Compose high-retention script for concept: "${concept.title}". 
      Hook: ${concept.hook}. Structure: ${concept.structure}.
      Format: Use [SCENE: description] markers for visual cues.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 8000 },
      },
    });
    return response.text || "Production failure: Script engine offline.";
  });
}

/**
 * Splits a script into visual scenes for the storyboard.
 */
export async function splitScriptIntoStoryboard(script: string): Promise<StoryboardScene[]> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Convert script into storyboard scenes:\n\n${script}`,
      config: {
        systemInstruction: "You are a professional cinematographer.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING, description: "Voiceover text" },
              visualPrompt: { type: Type.STRING, description: "Image generation prompt" },
              duration: { type: Type.NUMBER, description: "Seconds" },
            },
            required: ["id", "text", "visualPrompt", "duration"],
          },
        },
      },
    });
    return JSON.parse(response.text || "[]");
  });
}

/**
 * Generates a viral hook set.
 */
export async function generateViralHooks(concept: VideoConcept): Promise<{hook: string, reason: string}[]> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Engineer 5 viral hooks for: ${concept.title}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              hook: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ["hook", "reason"],
          },
        },
      },
    });
    return JSON.parse(response.text || "[]");
  });
}

/**
 * Generates cinematic visuals using the image model.
 */
export async function generateImageForScene(visualPrompt: string): Promise<string> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Cinematic 4k high-definition faceless stock footage style: ${visualPrompt}. Moody, professional, shallow depth of field.` }],
      },
      config: {
        imageConfig: { aspectRatio: "16:9" },
      },
    });
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    throw new Error("Visual synthesizer busy.");
  });
}

/**
 * Generates high-quality voiceover.
 */
export async function generateVoiceover(text: string): Promise<string> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Tone: Enthusiastic & Professional. Content: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) throw new Error("Voice production failed.");
    return data;
  });
}

/**
 * Compiles video using Veo (VEO-3.1-fast).
 */
export async function compileVideoWithVeo(prompt: string, images: string[]): Promise<string> {
  return withRetry(async () => {
    // Note: Caller must handle API key selection if needed for Veo.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Cinematic faceless video production: ${prompt}`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });
    
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Production error: Video compilation failed.");
    return `${downloadLink}&key=${process.env.API_KEY}`;
  });
}

export async function generateStrategy(niche: string, platform: string): Promise<StrategyPlan> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate 90-day growth roadmap for ${niche} on ${platform}`,
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
    return JSON.parse(response.text || "{}");
  });
}

export async function generateVideoConcepts(niche: string): Promise<VideoConcept[]> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Engineer 5 viral faceless video concepts for niche: ${niche}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
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
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["description", "tags"],
              },
            },
            required: ["title", "hook", "structure", "visualDirection", "seo"],
          },
        },
      },
    });
    const results = JSON.parse(response.text || "[]");
    const sources = extractSources(response);
    return results.map((r: any) => ({ ...r, sources }));
  });
}

export async function getTrendingGlobalNiches(): Promise<any[]> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: "Identify the top 5 highest-growth faceless YouTube/FB niches for 2025 based on current trends.",
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(response.text || "[]");
  });
}