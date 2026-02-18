import json
import logging
import os
from pathlib import Path

import faiss
import numpy as np
from google import genai

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 3072

_client = None
_index = None
_products = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Missing GEMINI_API_KEY")
        _client = genai.Client(api_key=api_key)
    return _client


def embed_text(text: str) -> np.ndarray:
    client = _get_client()
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
    )
    vec = np.array(response.embeddings[0].values, dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec


def embed_texts_batch(texts: list[str]) -> np.ndarray:
    client = _get_client()
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
    )
    vecs = np.array(
        [e.values for e in response.embeddings], dtype=np.float32
    )
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms[norms == 0] = 1
    vecs /= norms
    return vecs


def load_index(data_dir: str | Path | None = None):
    global _index, _products

    if data_dir is None:
        data_dir = Path(__file__).resolve().parent.parent / "data"
    else:
        data_dir = Path(data_dir)

    index_path = data_dir / "faiss.index"
    products_path = data_dir / "products.json"

    if not index_path.exists() or not products_path.exists():
        logger.warning(
            "Vector index not found at %s. Chat will work without product search.", data_dir
        )
        return False

    _index = faiss.read_index(str(index_path))
    with open(products_path, "r") as f:
        _products = json.load(f)

    logger.info(
        "Loaded FAISS index with %d vectors and %d products",
        _index.ntotal,
        len(_products),
    )
    return True


def search(query: str, k: int = 5) -> list[dict]:
    if _index is None or _products is None:
        return []

    query_vec = embed_text(query).reshape(1, -1)
    scores, indices = _index.search(query_vec, min(k, _index.ntotal))

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0 or idx >= len(_products):
            continue
        product = dict(_products[idx])
        product["score"] = float(score)
        results.append(product)

    return results
