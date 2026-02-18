import logging
import os
import uuid

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

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174"
)

# In-memory session tokens
active_tokens: set[str] = set()

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
    if req.password != SITE_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    token = str(uuid.uuid4())
    active_tokens.add(token)
    return {"token": token}


async def verify_token(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:]
    if token not in active_tokens:
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
