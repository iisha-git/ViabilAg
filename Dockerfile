# bioOasis: API + website in one container, with server-side OCR available.
FROM python:3.11-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt backend/requirements-ocr.txt backend/
RUN pip install --no-cache-dir -r backend/requirements-ocr.txt

COPY backend backend
COPY frontend frontend
COPY ml/artifacts ml/artifacts
COPY data/evidence data/evidence
COPY data/samples.json data/samples.json

# Run as an unprivileged user: the app needs no root rights.
RUN useradd --system --uid 10001 --create-home biooasis \
 && chown -R biooasis:biooasis /app
USER biooasis

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
# Hosts like Render/Railway/Fly set $PORT; locally it falls back to 8000.
# --proxy-headers makes rate limiting see the real caller. The default trusts
# forwarded headers from any peer, which is only safe when the host's own router
# is the only thing that can reach the container (true on Render/Railway/Fly).
# Where clients can connect directly, set FORWARDED_ALLOW_IPS to your proxy's
# address so callers cannot spoof their rate-limit identity.
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips=${FORWARDED_ALLOW_IPS:-*}"]
