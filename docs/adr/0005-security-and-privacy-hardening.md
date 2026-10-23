# 0005: Security and privacy hardening

Date: 2026-10-20. Status: accepted.

## Context

A privacy/security review ("regression") of v0.2.0 found real gaps: OCR
uploads were read fully into memory before the size check, there were no rate
limits, no security headers, coordinates travelled in a GET query string (so
they landed in access logs), the Docker image ran as root, and a `?api=` URL
parameter could silently repoint the frontend at any server.

## Decision

- `backend/app/security.py`: header middleware (CSP, nosniff, frame denial,
  no-referrer, Permissions-Policy) and a small in-memory per-IP sliding-window
  rate limiter. No new dependencies; the documented deployment is one
  container, so in-memory is the right size. Revisit if replicas ever scale out.
- `POST /api/conditions` added and the frontend switched to it, so coordinates
  never appear in a URL. The GET form stays for manual use, now with range
  validation.
- `/api/ocr` reads uploads in chunks and aborts at the cap; Pillow's
  MAX_IMAGE_PIXELS caps decompression bombs.
- The `?api=` query override is removed; the backend address is set only in
  `frontend/assets/config.js`.
- The Docker image runs as a non-root user.
- The README and `docs/deployment.md` describe the data flows honestly, including what third
  parties (Open-Meteo, CDNs, the host) receive.

## Consequences

Slightly more code in the backend; one new test file (`tests/test_security.py`)
locks the behavior in. Static hosting (Option B) gets no backend headers -
GitHub Pages et al. send their own - which is acceptable because static mode
talks only to Open-Meteo and the CDNs anyway.
