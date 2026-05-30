# Frag Forecast — API image (FastAPI + XGBoost + SHAP).
# Ships the trained model (backend/models) and the real-data SQLite DB
# (backend/data/cs2.db), so the container is self-contained — no token, no
# build-time ingest. Builds from the repo root; see render.yaml.
FROM python:3.12-slim

WORKDIR /app

# libgomp1 is required by xgboost's native lib.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install deps first for layer caching.
COPY backend/requirements-deploy.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# App code + model + db (relative ./models and ./data paths resolve here).
COPY backend/ ./

EXPOSE 8000

# Render injects $PORT; default to 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}"]
