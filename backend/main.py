import base64
import hashlib
import hmac
import json
import logging
import os
import time

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from routers import chat, tryon
from utils.vector_store import load_index

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SITE_PASSWORD = os.getenv("SITE_PASSWORD")
if not SITE_PASSWORD:
    raise ValueError("Missing SITE_PASSWORD in .env")

# Secret used to sign session tokens. Falls back to SITE_PASSWORD so no extra
# env var is required, but set a dedicated AUTH_SECRET in production.
AUTH_SECRET = (os.getenv("AUTH_SECRET") or SITE_PASSWORD).encode()

# How long a session token stays valid (seconds).
TOKEN_TTL = int(os.getenv("TOKEN_TTL_SECONDS", str(7 * 24 * 60 * 60)))

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174"
)


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_token() -> str:
    """Create a stateless, HMAC-signed session token with an expiry.

    No server-side storage, so tokens survive restarts and work across
    multiple workers/instances.
    """
    payload = _b64encode(json.dumps({"exp": int(time.time()) + TOKEN_TTL}).encode())
    signature = _b64encode(hmac.new(AUTH_SECRET, payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{signature}"


def is_token_valid(token: str) -> bool:
    try:
        payload, signature = token.split(".", 1)
    except ValueError:
        return False
    expected = _b64encode(hmac.new(AUTH_SECRET, payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        return False
    try:
        exp = json.loads(_b64decode(payload)).get("exp", 0)
    except ValueError:
        return False
    return time.time() < exp


app = FastAPI()

# CORS — only allow configured origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    password: str


@app.post("/api/login")
async def login(req: LoginRequest):
    if not hmac.compare_digest(req.password, SITE_PASSWORD):
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"token": create_token()}


async def verify_token(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:]
    if not is_token_valid(token):
        raise HTTPException(status_code=401, detail="Invalid or expired token")


app.include_router(tryon.router, prefix="/api", dependencies=[Depends(verify_token)])
app.include_router(chat.router, prefix="/api", dependencies=[Depends(verify_token)])


@app.on_event("startup")
async def startup_event():
    loaded = load_index()
    if loaded:
        logger.info("FAISS product index loaded successfully")
    else:
        logger.warning("FAISS index not found — chat will work without product search")
