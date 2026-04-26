# Vitalis v2.1 🧬

![Vitalis](https://img.shields.io/badge/Vitalis-v2.1-blue.svg)
![React](https://img.shields.io/badge/React-19.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)
![Firebase](https://img.shields.io/badge/Firebase-12.12-orange.svg)

Vitalis is a high-performance health and fitness dashboard tailored for deep biometric tracking, workout logging, and AI-driven insights. Designed with a sleek, data-rich interface, Vitalis acts as your personal performance laboratory.

## 📸 App Preview

*(Replace the placeholder URLs below with the paths to your actual images and videos once you upload them to your repository or image host)*

### Screen Recording / Demo

*(For GitHub, video files like `.mp4` can be dragged and dropped directly into the README editor, or you can use a .gif)*
<!-- If using a GIF: -->
![Vitalis Demo](assets/demo.gif)

<!-- If using a video file (works on GitHub): -->
<!-- <video src="assets/demo.mp4" controls="controls" style="max-width: 100%;"></video> -->

### Screenshots

<div align="center">
  <img src="assets/screenshot-1.png" alt="Dashboard View" width="45%" padding="5px" />
  <img src="assets/screenshot-2.png" alt="Metrics and Progress" width="45%" padding="5px" />
  <img src="assets/screenshot-3.png" alt="Workout Logging" width="45%" padding="5px" />
  <img src="assets/screenshot-4.png" alt="AI Insights" width="45%" padding="5px" />
</div>

## 🚀 Features

* **Bio-Metric Dashboard**: Real-time overview of your readiness, active calorie burn, step count, and hydration tracking.
* **Nutrition & Fueling**: Monitor your macronutrient intake (calories, protein, carbs, fiber, sugar) against customizable daily goals.
* **Session Logging**: Track lifting and cardio sessions. Add exercises, sets, weights, distances, and durations.
* **Consistency Heatmap**: Visualize your workout consistency over the last 35 days in a GitHub-style contribution heatmap.
* **AI Recovery Planner & Narratives**: Powered by AI (Llama 3 / Gemini via Groq API), Vitalis analyzes your recent metrics and workouts to generate actionable insights. Visually select sore muscles on a 3D-styled interactive body map to generate a custom recovery workout.
* **Progression & PR Tracker**: Chart your progress over time on core lifts (Squat, Bench Press, Deadlift) and cardio benchmarks (3 Mile Run).
* **Achievements & Milestones**: Unlocks gamified badges like "Consistency", "Heavy Lifter", "Iron Lungs", and "Hydro Homie".
* **Firebase Integration**: 
  * Google OAuth Authentication
  * Real-time Cloud Firestore synchronization
* **Automated iOS Health Export**: Integrates with Apple Shortcuts to export your Apple Health data directly to your Vitalis dashboard (`/api/health-data`).

## 🛠 Tech Stack

* **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, Framer Motion (for animations), Recharts (for data visualization), `react-body-highlighter` (for the AI Recovery Planner UI).
* **Backend**: Express (Node.js) using `tsx`.
* **Database & Auth**: Firebase Auth, Cloud Firestore (client & admin SDK).
* **AI Integration**: OpenAI SDK (configured for Groq/Llama).

## 📐 Architecture Diagrams

### Logical Architecture

This diagram illustrates the logical flow of data and separation of concerns between the frontend, backend APIs, Firebase services, and external integrations.

```mermaid
graph TD
    User([User / Athlete])
    AppleHealth([iOS Health App])
    
    subgraph "Vitalis Frontend (React SPA)"
        Dashboard[Dashboard UI]
        WorkoutLog[Workout Logger]
        AIPlanner[AI Recovery Planner]
        AuthUI[Authentication UI]
    end
    
    subgraph "Vitalis Backend Server (Express)"
        HealthSyncAPI[Health Data Sync API]
        AIAgent[LLM API Routes]
    end
    
    subgraph "Firebase Services"
        FirebaseAuth[Firebase Authentication]
        Firestore[Cloud Firestore DB]
    end
    
    subgraph "External Integration"
        LLMAPI[Groq API / Llama 3]
    end

    User -->|Views / Interacts| Dashboard
    User -->|Logs Session| WorkoutLog
    User -->|Selects Sore Muscles| AIPlanner
    User -->|Logs in via Google| AuthUI
    
    AppleHealth -->|Apple Shortcuts POST| HealthSyncAPI
    HealthSyncAPI -->|Stores Metrics| Firestore
    
    AuthUI <-->|OAuth Token| FirebaseAuth
    
    Dashboard <-->|Real-time Data SDK| Firestore
    WorkoutLog <-->|Saves Workouts SDK| Firestore
    
    AIPlanner -->|Sends Biometrics| AIAgent
    AIAgent <-->|Prompts & JSON Response| LLMAPI
    AIAgent -->|Generates Workout| AIPlanner
```

### Physical Architecture

This diagram visualizes how the application is physically deployed and networked within the hosting environment.

```mermaid
graph TD
    Client[Web Browser / Client]
    iOS[iOS Device / Apple Health]
    
    subgraph "Hosting Environment"
        Nginx[Reverse Proxy / TLS]
        
        subgraph "Node.js Container"
            NodeApp["Express Server (port 3000)"]
            StaticSite["Vite Static Files (dist/)"]
        end
    end
    
    subgraph "Google Cloud Platform"
        AuthService[Firebase Auth]
        FirestoreService[Firestore DB Instance]
    end
    
    subgraph "External Providers"
        AIModel[Groq API Services]
    end
    
    Client -- "HTTPS (port 443)" --> Nginx
    iOS -- "HTTPS POST (port 443)" --> Nginx
    
    Nginx -- "HTTP (port 3000)" --> NodeApp
    NodeApp -- "Serves" --> StaticSite
    
    NodeApp -- "REST API (HTTPS)" --> AIModel
    NodeApp -- "Admin SDK (gRPC/HTTPS)" --> FirestoreService
    
    Client -- "Client SDK (HTTPS)" --> AuthService
    Client -- "Client SDK (WebSockets)" --> FirestoreService
```

## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd <repository_directory>
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   * Create a `.env.local` file based on `.env.example`.
   * Add your `GEMINI_API_KEY` (or Groq API Key). 

4. **Firebase Configuration:**
   * Ensure `firebase-applet-config.json` is properly populated with your Firebase project details.
   * Put your Firebase service account details in `service-account.json`.

5. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   *The server runs locally on `http://localhost:3000`.*

## 📱 Integrating with Apple Health

You can automatically sync your iOS Health data to Vitalis using the Shortcuts app.

1. Create a Shortcut using the **Auto Health Export** action.
2. Set the destination format to JSON.
3. Use the "Get contents of URL" action to POST the JSON to your Vitalis API endpoint:
   `https://<your_deployed_domain>/api/health-data?userId=<your_firebase_uid>`

## 🔐 Data & Privacy

* Vitalis includes a built-in Data Accuracy Check to compare ingested records with native health apps.
* **Danger Zone**: You can permanently wipe all of your health metrics and workout data directly from the Profile tab.

## 📄 License

This project is open-source and available under the MIT License.
