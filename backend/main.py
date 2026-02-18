import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import chat, tryon
from utils.vector_store import load_index

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tryon.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    loaded = load_index()
    if loaded:
        logger.info("FAISS product index loaded successfully")
    else:
        logger.warning("FAISS index not found — chat will work without product search")
