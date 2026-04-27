# DeepVortex BTC Predictor

AI-powered Bitcoin price forecasting dashboard. An ensemble of LSTM, XGBoost, and Prophet models generates predictions at five horizons (4 h → 1 month). A React + Vite frontend displays live price, technical indicators, Fear & Greed sentiment, on-chain metrics, and model accuracy — all on a dark cyber-grid UI.

```
deepvortex-btc/
├── backend/    FastAPI · Python · LSTM + XGBoost + Prophet ensemble
└── frontend/   React · Vite · TailwindCSS · Chart.js
```

---

## Local Development

### Prerequisites

| Tool | Minimum version |
|------|----------------|
| Python | 3.11 |
| Node.js | 18 |
| npm | 9 |

### 1 — Clone

```bash
git clone https://github.com/deepvortexia/crypto.git
cd crypto
```

### 2 — Quick start (Windows)

Double-click **`start.bat`** in the project root.

It installs all dependencies and opens two terminal windows — one for the backend (port 8000) and one for the frontend dev server (port 5173).

### 3 — Manual start

#### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt

cp .env.example .env            # fill in values (see Environment Variables below)

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API is now at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`.

#### Frontend

```bash
cd frontend
npm install

# Create .env (one line is enough for local dev)
echo VITE_API_URL=http://localhost:8000 > .env

npm run dev
```

Dashboard is now at `http://localhost:5173`.

> **Note — first run:** the backend trains the ML models on startup. This can take 2–5 minutes depending on hardware. Prediction endpoints return HTTP 503 until training finishes; the UI shows a spinner and auto-retries every 30 seconds.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/status` | Model training status |
| GET | `/api/price/live` | Live BTC/USD price + 24 h stats |
| GET | `/api/predict/{horizon}` | Ensemble prediction (`4h` `8h` `12h` `24h` `1month`) |
| GET | `/api/indicators` | RSI, MACD, Bollinger Bands, EMA, OBV, ATR |
| GET | `/api/sentiment` | Fear & Greed Index + 7-day history |
| GET | `/api/onchain` | Hash rate, difficulty, mempool, fees, trade volume |
| GET | `/api/accuracy` | Historical accuracy per model per horizon |
| POST | `/api/admin/retrain` | Force model retrain (requires `X-Admin-Secret` header) |

---

## Free API Keys

All external APIs used have a free tier. Only CoinGecko benefits from a key; the others require no authentication.

### CoinGecko (optional but recommended)

- **What it unlocks:** raises the rate limit from ~30 req/min to 500 req/min on the free Demo tier. Without it the backend still works but may hit 429s under heavy load.
- **How to get it:**
  1. Go to [https://www.coingecko.com/en/api](https://www.coingecko.com/en/api)
  2. Click **"Get Your Free API Key"** → sign up
  3. Navigate to **Developer Dashboard → API Keys**
  4. Copy your Demo key
- **Set it as:** `COINGECKO_API_KEY` in `backend/.env`

### Alternative.me Fear & Greed

- No key required. Public endpoint: `https://api.alternative.me/fng/`

### Blockchain.info On-Chain Stats

- No key required. Public endpoint: `https://api.blockchain.info/stats`

---

## Deploy — Frontend to Vercel

1. Push this repo to GitHub (already done if you followed the git setup below).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. In **Configure Project**:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` *(pre-filled by vercel.json)*
   - **Output Directory:** `dist` *(pre-filled)*
4. Under **Environment Variables** add:
   ```
   VITE_API_URL = https://your-railway-app.up.railway.app
   ```
   (Fill in your Railway URL — deploy the backend first to get it.)
5. Click **Deploy**. Subsequent pushes to `main` redeploy automatically.

> `vercel.json` in `/frontend` already configures caching headers, security headers, and SPA rewrites — no extra setup needed.

---

## Deploy — Backend to Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Select this repository.
3. In **Settings → Service → Source**:
   - **Root Directory:** `backend`
4. Railway auto-detects `railway.toml` and uses:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
   ```
5. Under **Variables**, add:

   | Variable | Value |
   |----------|-------|
   | `COINGECKO_API_KEY` | your CoinGecko Demo key (optional) |
   | `CORS_ORIGINS` | `https://your-vercel-app.vercel.app` (comma-separated, no trailing slash) |
   | `MODEL_RETRAIN_INTERVAL_HOURS` | `24` |
   | `ADMIN_SECRET` | a long random string |

   (`PORT`, `PYTHONUNBUFFERED`, and `OMP_NUM_THREADS` are set automatically by `railway.toml`.)

6. Click **Deploy**. Copy the generated Railway URL (e.g. `https://crypto-production-xxxx.up.railway.app`) and paste it into the Vercel `VITE_API_URL` variable.

> **Free tier note:** Railway's free Hobby plan gives 500 CPU-hours/month. The backend idles well between requests. If you hit the limit, consider the $5/month Starter plan.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COINGECKO_API_KEY` | No | *(empty)* | CoinGecko Demo API key — raises rate limit to 500 req/min |
| `CORS_ORIGINS` | Yes (prod) | localhost variants | Comma-separated list of allowed frontend origins |
| `MODEL_RETRAIN_INTERVAL_HOURS` | No | `24` | How often the ensemble is automatically retrained |
| `ADMIN_SECRET` | Yes (prod) | `change_me_...` | Passed as `X-Admin-Secret` header to POST `/api/admin/retrain` |
| `PORT` | No | `8000` | HTTP port — Railway sets this automatically |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Full URL of the FastAPI backend, no trailing slash |

---

## Tech Stack

**Backend**

| Package | Purpose |
|---------|---------|
| FastAPI + Uvicorn | Async REST API |
| PyTorch (LSTM) | Sequence model for price prediction |
| XGBoost | Gradient-boosted tree model |
| Prophet | Facebook's time-series model |
| pandas / numpy | Data wrangling |
| APScheduler | Periodic model retraining |
| httpx | Async HTTP client for external APIs |
| cachetools TTLCache | In-memory caching (60 s – 1 h TTLs) |

**Frontend**

| Package | Purpose |
|---------|---------|
| React 18 | UI framework |
| Vite 5 | Build tool & dev server |
| TailwindCSS 3 | Utility-first styling |
| Chart.js 4 + react-chartjs-2 | Price chart with forecast overlay |

---

## Project Structure

```
deepvortex-btc/
├── .gitignore
├── README.md
├── start.bat                        Windows one-click dev launcher
│
├── backend/
│   ├── main.py                      FastAPI app, all routes, TTL caches
│   ├── requirements.txt
│   ├── railway.toml                 Railway deployment config
│   ├── .env.example
│   ├── data/                        Trained model artefacts (git-ignored)
│   ├── models/
│   │   ├── ensemble.py              Weighted ensemble logic
│   │   ├── lstm_model.py
│   │   ├── xgboost_model.py
│   │   └── prophet_model.py
│   └── services/
│       ├── data_fetcher.py          CoinGecko, Alternative.me, Blockchain.info
│       ├── indicators.py            RSI, MACD, Bollinger, EMA, OBV, ATR
│       └── retrainer.py             Scheduled retraining logic
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── vercel.json                  Vercel deployment config
    ├── .env.example
    └── src/
        ├── main.jsx                 Entry point
        ├── App.jsx                  Layout — assembles all 8 panels
        ├── index.css                Design tokens, .card, .badge-up/down
        ├── api/
        │   └── client.js            Typed API helpers (fetchLivePrice, etc.)
        └── components/
            ├── Header.jsx           Logo + live BTC ticker + 60 s countdown
            ├── HeroStats.jsx        Price · 24 h change · market cap · volume
            ├── PredictionCards.jsx  5 horizon cards with confidence bars
            ├── PriceChart.jsx       Chart.js — history (cyan) + forecast (amber)
            ├── IndicatorsPanel.jsx  RSI gauge · MACD · Bollinger Bands
            ├── SentimentGauge.jsx   Animated Fear & Greed arc gauge
            ├── OnchainPanel.jsx     Hash rate · mempool · fees · flows
            └── AccuracyPanel.jsx    Direction accuracy + MAPE per horizon
```
