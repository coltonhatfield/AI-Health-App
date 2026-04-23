import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import OpenAI from "openai";

// Initialize OpenAI for Groq
const groq = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY || "", 
  baseURL: "https://api.groq.com/openai/v1",
});

// Load Firebase Config safely
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (e) {
    console.error("Failed to parse firebase-applet-config.json");
  }
}

let appInstance: admin.app.App | null = null;

// Initialize Firebase Admin
if (!admin.apps.length && firebaseConfig.projectId) {
  const serviceAccountPath = path.resolve(process.cwd(), "service-account.json");
  let credential;

  if (fs.existsSync(serviceAccountPath)) {
    console.log("Using local service-account.json for authentication.");
    try {
      credential = admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf8")));
    } catch (e) {
      console.error("Failed to parse service-account.json");
      credential = admin.credential.applicationDefault();
    }
  } else {
    console.log("No local service account found, falling back to application default credentials.");
    credential = admin.credential.applicationDefault();
  }

  appInstance = admin.initializeApp({
    credential,
    projectId: firebaseConfig.projectId,
  });
} else if (admin.apps.length) {
  appInstance = admin.apps[0];
}

const db = appInstance 
  ? (firebaseConfig.firestoreDatabaseId 
      ? getFirestore(appInstance, firebaseConfig.firestoreDatabaseId) 
      : getFirestore(appInstance)) 
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route for Auto Health Export
  app.post("/api/health-data", async (req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      const payload = req.body;
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).json({ error: "userId query parameter is required" });
      }

      console.log(`Processing health data for user: ${userId}`);
      console.log("Raw Payload Keys:", Object.keys(payload));
      
      const metrics = payload.data?.metrics || [];
      console.log(`Received ${metrics.length} metrics from Shortcuts.`);

      // Log specific interesting metrics for debugging
      const specialMetrics = ['weight', 'height', 'body_mass', 'body_height'];
      
      let batch = db.batch();
      let count = 0;

      const processMetric = async (metric: any) => {
        if (!metric.name || !metric.data) return;
        
        const metricName = metric.name.toLowerCase().replace(/ /g, '_');
        const unit = metric.units || '';
        const dataPoints = metric.data || [];

        console.log(`- Metric "${metricName}": Found ${dataPoints.length} data points.`);

        for (const dp of dataPoints) {
          if (dp.qty === undefined || !dp.date) continue;

          const docRef = db.collection('health_metrics').doc();
          batch.set(docRef, {
            userId,
            type: metricName,
            value: Number(dp.qty),
            unit: unit,
            timestamp: admin.firestore.Timestamp.fromDate(new Date(dp.date)),
            source: "auto_health_export",
            rawData: dp
          });
          count++;
          
          if (count % 500 === 0) {
            await batch.commit();
            batch = db.batch();
          }
        }
      };

      for (const metric of metrics) {
        await processMetric(metric);
      }

      // Check if weight/height are outside the main metrics array (some apps do this)
      const outsideData = payload.data || {};
      const outsideMappings: Record<string, string> = {
        'weight': 'weight',
        'body_mass': 'weight',
        'bodyMass': 'weight',
        'height': 'height',
        'body_height': 'height',
        'heightMass': 'height' // Common typo in some shortcuts
      };

      for (const [key, normalizedName] of Object.entries(outsideMappings)) {
        if (outsideData[key]) {
          console.log(`Found outside metric: ${key} -> ${normalizedName}`);
          const val = outsideData[key];
          // Handle both { qty, units, date } and just a number
          const qty = typeof val === 'object' ? val.qty : val;
          const date = typeof val === 'object' ? val.date : new Date().toISOString();
          const unit = typeof val === 'object' ? val.units : '';

          if (qty !== undefined) {
            const docRef = db.collection('health_metrics').doc();
            batch.set(docRef, {
              userId,
              type: normalizedName,
              value: Number(qty),
              unit: unit,
              timestamp: admin.firestore.Timestamp.fromDate(new Date(date)),
              source: "auto_health_export_extra"
            });
            count++;
          }
        }
      }

      if (count > 0 && count % 500 !== 0) {
        await batch.commit();
      }

      console.log(`Successfully saved ${count} health data points.`);
      res.json({ status: "success", count });
    } catch (error) {
      console.error("Error receiving health data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // API Route for AI Insights (Groq)
  app.post("/api/ai-insights", async (req, res) => {
    try {
      const { metrics, workouts } = req.body;
      
      const prompt = `
        You are a high-performance health and fitness coach. 
        Analyze the health metrics and workout history provided below.
        Specifically look for:
        - Energy balance (Active vs Dietary energy)
        - Macro-nutrient ratios (Protein, Carbs, Sugars) relative to weight
        - Recovery status based on resting energy and activity
        - Body composition trends (Weight/Height)
        
        Data:
        Metrics: ${JSON.stringify(metrics)}
        Workouts: ${JSON.stringify(workouts)}
        
        Provide 3 concise, highly actionable "Narrative Insights" for the user. 
        Format your response as a JSON array of objects with exactly these keys: 'title', 'content', and 'category' (recovery, performance, or general).
        Only return the JSON array, no other text.
      `;

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile", // Or another Groq model
        messages: [
          { role: "system", content: "You are a specialized health analytics assistant that only outputs valid JSON arrays." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const responseText = completion.choices[0].message.content || "[]";
      // Groq with json_object mode requires the message to contain "json" and returns an object
      // We'll parse and extract the array if it's wrapped
      let result = JSON.parse(responseText);
      if (!Array.isArray(result) && result.insights) {
        result = result.insights;
      } else if (!Array.isArray(result) && Object.keys(result).length === 1) {
        result = Object.values(result)[0];
      }

      res.json(result);
    } catch (error) {
      console.error("Groq AI Error:", error);
      res.status(500).json({ error: "AI processing failed" });
    }
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
