import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

const db = admin.firestore();
if (firebaseConfig.firestoreDatabaseId) {
  // Use the specific database ID if provided
  // Note: Standard firebase-admin doesn't easily support dynamic DB IDs 
  // without specialized config, but this initialization is usually sufficient 
  // in this environment if the project default is used.
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route for Auto Health Export
  app.post("/api/health-data", async (req, res) => {
    try {
      const payload = req.body;
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).json({ error: "userId query parameter is required" });
      }

      console.log(`Processing health data for user: ${userId}`);
      
      const metrics = payload.data?.metrics || [];
      const batch = db.batch();
      let count = 0;

      for (const metric of metrics) {
        const metricName = metric.name.toLowerCase().replace(/ /g, '_');
        const unit = metric.units;
        const dataPoints = metric.data || [];

        for (const dp of dataPoints) {
          const docRef = db.collection('health_metrics').doc();
          batch.set(docRef, {
            userId,
            type: metricName,
            value: dp.qty,
            unit: unit,
            timestamp: admin.firestore.Timestamp.fromDate(new Date(dp.date)),
            source: "auto_health_export"
          });
          count++;
          
          // Batch size limit is 500
          if (count % 500 === 0) {
            await batch.commit();
          }
        }
      }

      if (count % 500 !== 0) {
        await batch.commit();
      }

      console.log(`Successfully saved ${count} health data points.`);
      res.json({ status: "success", count });
    } catch (error) {
      console.error("Error receiving health data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
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
