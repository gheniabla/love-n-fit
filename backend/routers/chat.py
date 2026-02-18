import logging
import os
import re

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from google import genai
from google.genai import types

from utils.vector_store import search as vector_search

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in .env")

client = genai.Client(api_key=GEMINI_API_KEY)
CHAT_MODEL = "gemini-2.5-flash"

router = APIRouter()

SYSTEM_INSTRUCTION = """You are a helpful Vuori clothing shopping assistant called "Love N Fit Assistant".
Your job is to help customers find the right Vuori clothing products based on their needs, preferences, and activities.

Guidelines:
- Be friendly, concise, and helpful
- When recommending products, always include the product URL on a separate line in this exact format: PRODUCT_URL: https://vuoriclothing.com/products/...
- You can recommend multiple products if relevant
- Ask clarifying questions if the customer's request is vague (e.g., what activity, preferred style, budget)
- Mention key details like material, price, and available sizes when recommending
- If a customer wants to try on a product, suggest they click "Use this product" on the recommendation card
- Stay focused on Vuori products only"""


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ProductCard(BaseModel):
    name: str
    url: str
    price: float
    category: str = ""
    material: str = ""


class ChatResponse(BaseModel):
    reply: str
    suggested_product_url: str | None = None
    products: list[ProductCard] = []


def _extract_product_urls(text: str) -> list[str]:
    """Extract PRODUCT_URL: lines from the response."""
    return re.findall(r"PRODUCT_URL:\s*(https?://[^\s]+)", text)


def _clean_reply(text: str) -> str:
    """Remove PRODUCT_URL: lines from the visible reply text."""
    return re.sub(r"\n?PRODUCT_URL:\s*https?://[^\s]+", "", text).strip()


@router.post("/chat")
async def chat(request: ChatRequest):
    try:
        # Vector search for relevant products
        search_results = vector_search(request.message, k=5)

        # Build product context
        product_context = ""
        if search_results:
            product_lines = []
            for p in search_results:
                line = f"- {p['name']}"
                if p.get("price"):
                    line += f" (${p['price']:.2f})"
                if p.get("category"):
                    line += f" | {p['category']}"
                if p.get("material"):
                    line += f" | {p['material']}"
                if p.get("sizes"):
                    line += f" | Sizes: {', '.join(p['sizes'])}"
                line += f"\n  URL: {p['url']}"
                product_lines.append(line)
            product_context = "\n\nRelevant products from our catalog:\n" + "\n".join(product_lines)

        # Build conversation history for Gemini
        contents = []
        for msg in request.history:
            contents.append(
                types.Content(
                    role="user" if msg.role == "user" else "model",
                    parts=[types.Part.from_text(text=msg.content)],
                )
            )

        # Add current user message with product context
        user_message = request.message
        if product_context:
            user_message += product_context

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_message)],
            )
        )

        response = client.models.generate_content(
            model=CHAT_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_modalities=["TEXT"],
            ),
        )

        reply_text = ""
        if response.candidates and len(response.candidates) > 0:
            parts = response.candidates[0].content.parts
            if parts:
                for part in parts:
                    if hasattr(part, "text") and part.text:
                        reply_text = part.text
                        break

        if not reply_text:
            reply_text = "I'm sorry, I couldn't generate a response. Please try again."

        # Extract product URLs from reply
        product_urls = _extract_product_urls(reply_text)
        clean_reply = _clean_reply(reply_text)

        # Match URLs back to search results for product cards
        product_cards = []
        url_set = set()
        for url in product_urls:
            clean_url = url.split("?")[0].rstrip("/")
            if clean_url in url_set:
                continue
            url_set.add(clean_url)
            # Find matching product from search results
            matched = None
            for p in search_results:
                if p["url"].split("?")[0].rstrip("/") == clean_url:
                    matched = p
                    break
            if matched:
                product_cards.append(ProductCard(
                    name=matched["name"],
                    url=matched["url"],
                    price=matched.get("price", 0),
                    category=matched.get("category", ""),
                    material=matched.get("material", ""),
                ))
            else:
                # URL from Gemini response not in search results — include with URL as name
                product_cards.append(ProductCard(
                    name=clean_url.split("/")[-1].replace("-", " ").title(),
                    url=clean_url,
                    price=0,
                ))

        suggested_url = product_urls[0] if product_urls else None

        return ChatResponse(
            reply=clean_reply,
            suggested_product_url=suggested_url,
            products=product_cards,
        )

    except Exception as e:
        logger.error("Error in /api/chat: %s", e)
        error_msg = str(e)
        if "RESOURCE_EXHAUSTED" in error_msg or "429" in error_msg:
            raise HTTPException(
                status_code=429,
                detail="API quota exceeded. Please wait and try again.",
            )
        raise HTTPException(status_code=500, detail="Chat service error")
