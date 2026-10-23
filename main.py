# Vercel entrypoint: zero-config FastAPI looks for `app` in main.py at the root.
# The real application (API + bundled frontend) lives in backend/app/main.py.
from backend.app.main import app  # noqa: F401
