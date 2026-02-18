"""
Scrape all Vuori products from sitemap and build a FAISS index.

Usage:
    cd backend && poetry run python -m scripts.index_products
"""

import asyncio
import json
import logging
import re
import time
from pathlib import Path

import faiss
import httpx
import numpy as np
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from lxml import etree

load_dotenv()

# Reuse helpers from the scraper
from utils.vuori_scraper import (
    _HEADERS,
    _extract_image_url,
    _extract_jsonld,
    _extract_material,
    _extract_sizes,
)
from utils.vector_store import EMBEDDING_DIM, embed_texts_batch

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SITEMAP_URL = "https://vuoriclothing.com/sitemap.xml"
PRODUCT_URL_PATTERN = re.compile(r"https?://(www\.)?vuoriclothing\.com/products/.+")
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
BATCH_SIZE = 20
FETCH_DELAY = 0.3


async def fetch_sitemap_urls() -> list[str]:
    """Fetch and parse the sitemap to extract product URLs."""
    async with httpx.AsyncClient(headers=_HEADERS, follow_redirects=True, timeout=30.0) as client:
        resp = await client.get(SITEMAP_URL)
        resp.raise_for_status()

    root = etree.fromstring(resp.content)
    ns = {"ns": "http://www.sitemaps.org/schemas/sitemap/0.9"}

    urls = []
    # Check if it's a sitemap index (contains other sitemaps)
    sitemap_locs = root.findall(".//ns:sitemap/ns:loc", ns)
    if sitemap_locs:
        # Fetch each child sitemap
        async with httpx.AsyncClient(headers=_HEADERS, follow_redirects=True, timeout=30.0) as client:
            for loc in sitemap_locs:
                sub_url = loc.text.strip()
                try:
                    sub_resp = await client.get(sub_url)
                    sub_resp.raise_for_status()
                    sub_root = etree.fromstring(sub_resp.content)
                    for url_elem in sub_root.findall(".//ns:url/ns:loc", ns):
                        url = url_elem.text.strip()
                        if PRODUCT_URL_PATTERN.match(url):
                            urls.append(url)
                except Exception as e:
                    logger.warning("Failed to fetch sub-sitemap %s: %s", sub_url, e)
    else:
        # Direct sitemap with <url> entries
        for url_elem in root.findall(".//ns:url/ns:loc", ns):
            url = url_elem.text.strip()
            if PRODUCT_URL_PATTERN.match(url):
                urls.append(url)

    # Deduplicate by stripping query params
    seen = set()
    unique = []
    for url in urls:
        clean = url.split("?")[0].rstrip("/")
        if clean not in seen:
            seen.add(clean)
            unique.append(clean)

    return unique


async def scrape_product(client: httpx.AsyncClient, url: str) -> dict | None:
    """Scrape a single product page and return metadata dict."""
    try:
        resp = await client.get(url)
        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")
        data = _extract_jsonld(soup)
        if not data:
            return None

        name = data.get("name", "")
        if not name:
            return None

        description = data.get("description", "")
        brand_info = data.get("brand", {})
        brand = brand_info.get("name", "Vuori") if isinstance(brand_info, dict) else str(brand_info)
        category = data.get("category", "")
        material = data.get("material", "") or _extract_material(description)

        # Price
        price_val = data.get("offers", [{}])
        if isinstance(price_val, list) and price_val:
            price = float(price_val[0].get("price", 0))
        elif isinstance(price_val, dict):
            price = float(price_val.get("price", 0))
        else:
            price = 0.0
        if not price:
            price = float(data.get("price", 0))

        # Sizes (no color hint for indexing — include all)
        sizes = _extract_sizes(data)
        size_names = [s["size"] for s in sizes]

        image_url = _extract_image_url(data)

        rating_data = data.get("aggregateRating", {})
        rating = float(rating_data.get("ratingValue", 0)) if rating_data else None

        return {
            "name": name,
            "url": url,
            "description": description,
            "brand": brand,
            "category": category,
            "material": material,
            "price": price,
            "sizes": size_names,
            "image_url": image_url,
            "rating": rating,
        }
    except Exception as e:
        logger.warning("Error scraping %s: %s", url, e)
        return None


def build_text_blob(product: dict) -> str:
    """Build a text representation for embedding."""
    parts = [product["name"]]
    if product["brand"]:
        parts.append(f"by {product['brand']}")
    if product["category"]:
        parts.append(product["category"])
    if product["material"]:
        parts.append(product["material"])
    if product["description"]:
        # Truncate long descriptions
        desc = product["description"][:300]
        parts.append(desc)
    if product["sizes"]:
        parts.append(f"Sizes: {', '.join(product['sizes'])}")
    if product["price"]:
        parts.append(f"${product['price']:.2f}")
    return ". ".join(parts)


async def main():
    logger.info("Fetching Vuori sitemap...")
    urls = await fetch_sitemap_urls()
    logger.info("Found %d product URLs", len(urls))

    if not urls:
        logger.error("No product URLs found. Exiting.")
        return

    products = []
    async with httpx.AsyncClient(headers=_HEADERS, follow_redirects=True, timeout=15.0) as client:
        for i, url in enumerate(urls):
            product = await scrape_product(client, url)
            if product:
                products.append(product)
            if (i + 1) % 50 == 0:
                logger.info("Scraped %d / %d URLs (%d products)", i + 1, len(urls), len(products))
            await asyncio.sleep(FETCH_DELAY)

    logger.info("Scraped %d products total", len(products))

    if not products:
        logger.error("No products extracted. Exiting.")
        return

    # Build text blobs and generate embeddings in batches
    texts = [build_text_blob(p) for p in products]
    all_vecs = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        try:
            vecs = embed_texts_batch(batch)
            all_vecs.append(vecs)
        except Exception as e:
            logger.error("Embedding batch %d failed: %s", i // BATCH_SIZE, e)
            # Fall back to individual embedding
            for text in batch:
                try:
                    from utils.vector_store import embed_text
                    vec = embed_text(text).reshape(1, -1)
                    all_vecs.append(vec)
                except Exception as e2:
                    logger.warning("Skipping text due to embedding error: %s", e2)
        if i + BATCH_SIZE < len(texts):
            time.sleep(0.2)  # Rate limit
        logger.info("Embedded %d / %d products", min(i + BATCH_SIZE, len(texts)), len(texts))

    if not all_vecs:
        logger.error("No embeddings generated. Exiting.")
        return

    matrix = np.vstack(all_vecs)

    # Trim products to match matrix rows (in case some failed)
    if matrix.shape[0] < len(products):
        products = products[: matrix.shape[0]]

    # Build FAISS index (IndexFlatIP for cosine similarity with normalized vectors)
    index = faiss.IndexFlatIP(EMBEDDING_DIM)
    index.add(matrix)

    # Save
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(DATA_DIR / "faiss.index"))
    with open(DATA_DIR / "products.json", "w") as f:
        json.dump(products, f, indent=2)

    logger.info(
        "Saved FAISS index (%d vectors) and products.json (%d products) to %s",
        index.ntotal,
        len(products),
        DATA_DIR,
    )


if __name__ == "__main__":
    asyncio.run(main())
