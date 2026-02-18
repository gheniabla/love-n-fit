import json
import re
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException


@dataclass
class VuoriProduct:
    name: str
    description: str
    brand: str
    category: str
    material: str
    price: float
    currency: str
    image_url: str
    image_bytes: bytes
    image_mime_type: str
    available_sizes: list[dict] = field(default_factory=list)
    rating: float | None = None
    url: str = ""


_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_VUORI_URL_PATTERN = re.compile(
    r"^https?://(www\.)?vuoriclothing\.com/products/.+"
)


def _validate_url(url: str) -> str:
    url = url.split("?")[0].strip()
    if not _VUORI_URL_PATTERN.match(url):
        raise HTTPException(
            status_code=400,
            detail="Invalid URL. Please provide a Vuori product URL (https://vuoriclothing.com/products/...)",
        )
    return url


def _extract_jsonld(soup: BeautifulSoup) -> dict | None:
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict) and data.get("@type") in (
                "Product",
                "ProductGroup",
            ):
                return data
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("@type") in (
                        "Product",
                        "ProductGroup",
                    ):
                        return item
        except (json.JSONDecodeError, TypeError):
            continue
    return None


def _extract_material(description: str) -> str:
    match = re.search(r"(\d+%\s*\w+(?:[,/]\s*\d+%\s*\w+)*)", description)
    return match.group(1) if match else ""


def _extract_sizes(data: dict, color_hint: str = "") -> list[dict]:
    sizes = []
    seen = set()

    offers = data.get("offers", [])
    if isinstance(offers, dict):
        offers = [offers]

    has_offers = data.get("hasVariant", [])
    if has_offers:
        # Filter to matching color if we have a hint from the URL
        if color_hint:
            color_filtered = [
                v for v in has_offers
                if color_hint.lower() in v.get("color", "").lower()
                or color_hint.lower() in v.get("name", "").lower()
            ]
            if color_filtered:
                has_offers = color_filtered
        offers = has_offers

    for offer in offers:
        size = offer.get("size", "")
        if not size:
            name = offer.get("name", "")
            parts = name.rsplit(" - ", 1)
            if len(parts) == 2:
                size = parts[-1].strip()

        if not size or size in seen:
            continue
        seen.add(size)

        # Availability can be at offer level or nested in offer["offers"]
        availability = offer.get("availability", "")
        if not availability:
            nested_offers = offer.get("offers", {})
            if isinstance(nested_offers, dict):
                availability = nested_offers.get("availability", "")
            elif isinstance(nested_offers, list) and nested_offers:
                availability = nested_offers[0].get("availability", "")
        is_available = "InStock" in str(availability)

        sizes.append({
            "size": size,
            "available": is_available,
        })

    return sizes


def _extract_image_url(data: dict) -> str:
    image = data.get("image", [])
    if isinstance(image, list) and image:
        return image[0]
    if isinstance(image, str):
        return image
    return ""


def _mime_from_url(url: str) -> str:
    lower = url.lower().split("?")[0]
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


async def scrape_vuori_product(product_url: str) -> VuoriProduct:
    clean_url = _validate_url(product_url)

    async with httpx.AsyncClient(headers=_HEADERS, follow_redirects=True, timeout=15.0) as client:
        resp = await client.get(clean_url)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch Vuori product page (HTTP {resp.status_code})",
            )

        soup = BeautifulSoup(resp.text, "html.parser")
        data = _extract_jsonld(soup)

        if not data:
            raise HTTPException(
                status_code=422,
                detail="Could not extract product data from the page. Make sure the URL is a valid Vuori product page.",
            )

        name = data.get("name", "Unknown Product")
        description = data.get("description", "")
        brand_info = data.get("brand", {})
        brand = brand_info.get("name", "Vuori") if isinstance(brand_info, dict) else str(brand_info)
        category = data.get("category", "")
        material = data.get("material", "") or _extract_material(description)

        price_val = data.get("offers", [{}])
        if isinstance(price_val, list) and price_val:
            price = float(price_val[0].get("price", 0))
            currency = price_val[0].get("priceCurrency", "USD")
        elif isinstance(price_val, dict):
            price = float(price_val.get("price", 0))
            currency = price_val.get("priceCurrency", "USD")
        else:
            price = 0.0
            currency = "USD"

        if not price:
            price = float(data.get("price", 0))
            currency = data.get("priceCurrency", "USD")

        # Extract color hint from URL slug (e.g., "cypress-vintage-crew-sandalwood" -> "sandalwood")
        slug = clean_url.rstrip("/").split("/")[-1]
        color_hint = slug.rsplit("-", 1)[-1] if "-" in slug else ""
        available_sizes = _extract_sizes(data, color_hint=color_hint)
        image_url = _extract_image_url(data)

        rating_data = data.get("aggregateRating", {})
        rating = float(rating_data.get("ratingValue", 0)) if rating_data else None

        if not image_url:
            raise HTTPException(
                status_code=422,
                detail="Could not find a product image on the page.",
            )

        img_resp = await client.get(image_url)
        if img_resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Failed to download the product image.",
            )

        image_bytes = img_resp.content
        content_type = img_resp.headers.get("content-type", "")
        if "png" in content_type:
            image_mime_type = "image/png"
        elif "webp" in content_type:
            image_mime_type = "image/webp"
        elif "jpeg" in content_type or "jpg" in content_type:
            image_mime_type = "image/jpeg"
        else:
            image_mime_type = _mime_from_url(image_url)

    return VuoriProduct(
        name=name,
        description=description,
        brand=brand,
        category=category,
        material=material,
        price=price,
        currency=currency,
        image_url=image_url,
        image_bytes=image_bytes,
        image_mime_type=image_mime_type,
        available_sizes=available_sizes,
        rating=rating if rating else None,
        url=clean_url,
    )
