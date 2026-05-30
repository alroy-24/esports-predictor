# 🚀 Deploying Frag Forecast

Two free services:

- **API (FastAPI + model)** → **Render** (Docker web service)
- **Dashboard (Next.js)** → **Vercel**

The trained model (`backend/models/xgb_calibrated.joblib`) and the real-data DB
(`backend/data/cs2.db`) are committed, so the API container is self-contained —
no PandaScore token, no build-time ingest.

---

## 1. Backend → Render

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Go to <https://dashboard.render.com> → **New ▸ Blueprint**.
3. Pick this repo. Render reads [`render.yaml`](render.yaml) and builds the root
   [`Dockerfile`](Dockerfile) — a `frag-forecast-api` **free** web service.
4. Wait for the first build (~3–5 min; installs xgboost/shap). When it's live,
   note the URL, e.g. `https://frag-forecast-api.onrender.com`.
5. Sanity-check it: open `…/health` (should be `{"status":"ok","model_loaded":true,…}`)
   and `…/docs` for the interactive API.

> **Free-tier note:** the service sleeps after ~15 min idle and takes ~50s to wake.
> The dashboard shows a friendly "Can't reach the API" panel during a cold start.

Prefer not to use a Blueprint? Create a **Web Service** manually, choose
**Docker**, leave the Dockerfile path as `./Dockerfile`, plan **Free**, and add
env var `ALLOWED_ORIGINS=*`.

---

## 2. Frontend → Vercel

1. Go to <https://vercel.com/new> and import this repo.
2. **Set the Root Directory to `frontend`** (Vercel detects Next.js automatically).
3. Add an environment variable:

   | Name                  | Value                                       |
   | --------------------- | ------------------------------------------- |
   | `NEXT_PUBLIC_API_URL` | your Render URL, e.g. `https://frag-forecast-api.onrender.com` (no trailing slash) |

4. **Deploy.** Your dashboard is live at `https://<project>.vercel.app`.

---

## 3. Lock down CORS (optional, recommended)

Once you know the Vercel URL, tighten the API: in Render → the service →
**Environment**, set

```
ALLOWED_ORIGINS=https://<your-project>.vercel.app
```

and let it redeploy.

---

## Local sanity check (Docker)

```bash
docker build -t frag-forecast-api .
docker run -p 8000:8000 frag-forecast-api
# → http://localhost:8000/health
```

---

## Updating the demo data

The committed DB/model are a snapshot. To refresh with new real data, re-run the
backend pipeline locally (see [backend/README.md](backend/README.md)) and commit
the updated `backend/data/cs2.db` + `backend/models/xgb_calibrated.joblib` +
`backend/models/metrics.json`. Render auto-deploys on push.
