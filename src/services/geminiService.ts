export interface HealthContext {
  metrics: any[];
  workouts: any[];
}

export async function getAIRecommendations(context: HealthContext) {
  try {
    const response = await fetch("/api/ai-insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(context),
    });

    if (!response.ok) {
      throw new Error(`AI Request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("AI Insight Error:", error);
    return [];
  }
}
