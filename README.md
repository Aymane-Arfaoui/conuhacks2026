# EyeWatch 👁️

**AI-Powered Realtime Surveillance Intelligence**

Streams webcam frames to a Python FastAPI backend for real-time analysis using YOLOv8 object detection and MediaPipe pose/hand tracking.

## Features

- 🎥 **Realtime Webcam Streaming** - Configurable FPS (2-10)
- 🤖 **YOLOv8 Detection** - Person and object detection with tracking
- 🦴 **Pose Estimation** - Full body skeleton with MediaPipe
- 🖐️ **Hand Tracking** - Left/right hand landmarks + gesture detection
- 🚨 **Event Detection**: Zone intrusion, loitering, fall detection
- 📊 **Event Feed** - Real-time severity-coded event log
- 📝 **Report Generation** - AI-powered incident reports (optional)

## Project Structure

```
conuhacks2026/
├── analyzer/              # Python FastAPI backend
│   ├── main.py            # WebSocket server
│   ├── yolo.py            # YOLOv8 detection
│   ├── mediapipe_models.py # Pose & hand tracking
│   ├── events.py          # Event detection logic
│   ├── buffer.py          # Track state management
│   └── requirements.txt
├── app/                   # Next.js frontend
│   ├── realtime/page.tsx  # Main surveillance page
│   └── api/report/route.ts # Report generation API
├── package.json
└── .env.local             # Your API keys
```

## Quick Start

### Terminal 1 - Python Backend

```bash
cd analyzer
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2 - Next.js Frontend

```bash
npm run dev
```

### Open the App

Navigate to **http://localhost:3000/realtime** and click **START**.

## Environment Variables

Your `.env.local` already has the keys. They're used for:

| Key | Purpose |
|-----|---------|
| `OPENAI_API_KEY` | Report generation (server-side) |
| `GEMINI_API_KEY` | AI reasoning on events (optional) |

Add this to `.env.local` for the WebSocket URL:
```
NEXT_PUBLIC_ANALYZER_WS_URL=ws://127.0.0.1:8000/ws
```

## API Reference

### WebSocket `/ws`

- **Client sends:** Binary JPEG frame data
- **Server responds:** JSON with detections, pose, hands, events

### HTTP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/zone` | Get restricted zone polygon |
| POST | `/zone` | Update restricted zone |

## Event Types

| Type | Severity | Trigger |
|------|----------|---------|
| INTRUSION | 1 | Person enters restricted zone |
| LOITERING | 2 | Person in zone > 10 seconds |
| FALL | 3 | Body angle/bbox suggests fall |

---

Built for ConuHacks 2026 🚀
