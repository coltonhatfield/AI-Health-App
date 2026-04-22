import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface HealthContext {
  metrics: any[];
  workouts: any[];
}

export async function getAIRecommendations(context: HealthContext) {
  const prompt = `
    You are a high-performance health and fitness coach. 
    Analyze the health metrics and workout history provided below.
    Specifically look for:
    - Energy balance (Active vs Dietary energy)
    - Macro-nutrient ratios (Protein, Carbs, Sugars) relative to weight
    - Recovery status based on resting energy and activity
    - Body composition trends (Weight/Height)
    
    Data:
    Metrics: ${JSON.stringify(context.metrics)}
    Workouts: ${JSON.stringify(context.workouts)}
    
    Provide 3 concise, highly actionable "Narrative Insights". 
    Format as a JSON array of objects with 'title', 'content', and 'category' (recovery, performance, or general).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["title", "content", "category"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Insight Error:", error);
    return [];
  }
}
