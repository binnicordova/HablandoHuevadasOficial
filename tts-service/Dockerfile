# OmniVoice text-to-speech for the voice chat. Build and deploy with:
#
#   gcloud run deploy hh-tts --source tts-service --region us-east1 \
#     --no-allow-unauthenticated --concurrency 1 --cpu 4 --memory 16Gi \
#     --timeout 540 --max-instances 3 --set-env-vars STORAGE_BUCKET=<bucket>
#
# CPU-only on purpose (cheapest). For a GPU add --gpu 1 --gpu-type nvidia-l4
# and OMNIVOICE_DEVICE=cuda:0, and swap the torch line in requirements.txt.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/models \
    OMNIVOICE_STEPS=8

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the weights into the image: a cold start then loads from local disk
# instead of downloading ~2.4 GB first.
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('k2-fsa/OmniVoice')"

COPY engine.py tts_service.py server.py ./
CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}
