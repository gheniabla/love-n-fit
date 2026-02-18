import base64
import logging
import re
import traceback

from dotenv import load_dotenv
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from google import genai
from google.genai import types

from utils.vuori_scraper import scrape_vuori_product

load_dotenv()

import os

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in .env")

client = genai.Client(api_key=GEMINI_API_KEY)

IMAGE_MODELS = [
    "gemini-3-pro-image-preview",
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-exp-image-generation",
]
TEXT_MODEL = "gemini-2.5-flash"

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
MAX_IMAGE_SIZE_MB = 10

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


def _convert_measurements(height_feet: int, height_inches: int, weight_lbs: int):
    total_inches = (height_feet * 12) + height_inches
    total_cm = total_inches * 2.54
    weight_kg = weight_lbs * 0.453592
    return total_cm, weight_kg


def _build_image_prompt(product, instructions):
    extra = f"\nAdditional notes: {instructions}." if instructions else ""
    return (
        f"IMAGE 1 is the IDENTITY REFERENCE photo of a real person who uploaded their image with full consent. "
        f"IMAGE 2 is the CLOTHING REFERENCE showing the {product.name}.\n\n"
        f"Generate a single photorealistic image of the EXACT same person from IMAGE 1 "
        f"wearing the {product.name} from IMAGE 2.\n\n"
        f"CRITICAL IDENTITY REQUIREMENTS — preserve with absolute fidelity:\n"
        f"- Facial structure, bone structure, and face shape\n"
        f"- Eye color, eye shape, and eye spacing\n"
        f"- Nose shape and size\n"
        f"- Mouth shape and lip proportions\n"
        f"- Skin tone and complexion\n"
        f"- Hair color, texture, length, and style\n"
        f"- Body proportions and build\n"
        f"- Any distinctive features (freckles, moles, scars, dimples)\n\n"
        f"CHANGE ONLY the clothing: realistically drape and fit the {product.name} "
        f"onto the person, matching the lighting and shadows of the original photo.\n"
        f"Do not morph, blend, or alter any facial features. "
        f"The generated face must be indistinguishable from IMAGE 1."
        f"{extra}"
    )


def _build_text_prompt(product, height_feet, height_inches, weight_lbs, instructions):
    total_cm, weight_kg = _convert_measurements(height_feet, height_inches, weight_lbs)

    sizes_string = ", ".join(
        f"{s['size']} ({'in stock' if s['available'] else 'out of stock'})"
        for s in product.available_sizes
    )

    return f"""Pick the best size and give a brief summary. Be concise — 3-4 sentences max.

Person: {height_feet}'{height_inches}", {weight_lbs} lbs
Product: {product.name} ({product.brand}), {product.category}, {product.material}
Sizes in stock: {sizes_string}
{f"Note: {instructions}" if instructions else ""}

Reply in exactly this format:
RECOMMENDED_SIZE: [size]

[2-3 sentences: why this size, how it fits, one styling tip]"""


def _parse_recommended_size(text: str) -> tuple[str, str]:
    match = re.search(r"RECOMMENDED_SIZE:\s*(.+)", text)
    recommended_size = match.group(1).strip() if match else "Unable to determine"
    clean_text = re.sub(r"RECOMMENDED_SIZE:\s*.+\n?", "", text).strip()
    return recommended_size, clean_text


@router.post("/try-on")
async def try_on(
    person_image: UploadFile = File(...),
    product_url: str = Form(...),
    height_feet: int = Form(...),
    height_inches: int = Form(...),
    weight_lbs: int = Form(...),
    instructions: str = Form(""),
):
    try:
        # Validate person image
        if person_image.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {person_image.content_type}",
            )

        person_bytes = await person_image.read()

        if len(person_bytes) / (1024 * 1024) > MAX_IMAGE_SIZE_MB:
            raise HTTPException(
                status_code=400, detail="Person image exceeds 10MB size limit"
            )

        # Validate measurements
        if not (3 <= height_feet <= 7):
            raise HTTPException(
                status_code=400, detail="Height feet must be between 3 and 7"
            )
        if not (0 <= height_inches <= 11):
            raise HTTPException(
                status_code=400, detail="Height inches must be between 0 and 11"
            )
        if not (50 <= weight_lbs <= 500):
            raise HTTPException(
                status_code=400, detail="Weight must be between 50 and 500 lbs"
            )

        # Scrape Vuori product
        product = await scrape_vuori_product(product_url)

        logger.info("Sending requests to Gemini for product: %s", product.name)

        # --- CALL 1: Image generation (simple prompt, images first) ---
        image_prompt = _build_image_prompt(product, instructions)

        contents = [
            types.Part.from_bytes(
                data=person_bytes,
                mime_type=person_image.content_type,
            ),
            types.Part.from_bytes(
                data=product.image_bytes,
                mime_type=product.image_mime_type,
            ),
            image_prompt,
        ]

        config = types.GenerateContentConfig(
            system_instruction=(
                "You are a virtual try-on assistant. Your absolute top priority "
                "is preserving the exact facial identity, facial structure, skin tone, "
                "hair, and body proportions of the person in the reference photo. "
                "Only change their clothing. Never morph, blend, or alter facial features. "
                "The person's face is a sacred, immutable element."
            ),
            response_modalities=["TEXT", "IMAGE"],
            safety_settings=[
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
            ],
        )

        # Try each image model, fallback on quota/error
        image_data = None
        image_mime_type = "image/png"
        for model_name in IMAGE_MODELS:
            try:
                image_response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config,
                )
                if image_response.candidates and len(image_response.candidates) > 0:
                    parts = image_response.candidates[0].content.parts
                    if parts:
                        for part in parts:
                            if hasattr(part, "inline_data") and part.inline_data:
                                image_data = part.inline_data.data
                                image_mime_type = getattr(
                                    part.inline_data, "mime_type", "image/png"
                                )
                if image_data:
                    logger.info("Image generated with model: %s", model_name)
                    break
            except Exception as model_err:
                logger.warning("Model %s failed: %s", model_name, model_err)
                continue

        image_url = None
        if image_data:
            image_base64 = base64.b64encode(image_data).decode("utf-8")
            image_url = f"data:{image_mime_type};base64,{image_base64}"

        # --- CALL 2: Size recommendation + description (text-only, fast model) ---
        text_prompt = _build_text_prompt(
            product, height_feet, height_inches, weight_lbs, instructions
        )

        text_response_obj = client.models.generate_content(
            model=TEXT_MODEL,
            contents=[text_prompt],
            config=types.GenerateContentConfig(
                response_modalities=["TEXT"]
            ),
        )

        text_response = "No description available."
        if text_response_obj.candidates and len(text_response_obj.candidates) > 0:
            parts = text_response_obj.candidates[0].content.parts
            if parts:
                for part in parts:
                    if hasattr(part, "text") and part.text:
                        text_response = part.text
                        break

        # Extract recommended size from text
        recommended_size, clean_text = _parse_recommended_size(text_response)

        # Build product info for frontend
        product_info = {
            "name": product.name,
            "brand": product.brand,
            "price": f"${product.price:.2f}" if product.price else "N/A",
            "material": product.material,
            "category": product.category,
            "available_sizes": product.available_sizes,
            "rating": product.rating,
            "url": product.url,
        }

        return JSONResponse(
            content={
                "image": image_url,
                "text": clean_text,
                "recommended_size": recommended_size,
                "product_info": product_info,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in /api/try-on endpoint: %s", e)
        traceback.print_exc()
        error_msg = str(e)
        if "RESOURCE_EXHAUSTED" in error_msg or "429" in error_msg:
            raise HTTPException(
                status_code=429,
                detail="Gemini API quota exceeded. Please wait and try again later, or upgrade your API plan.",
            )
        if "INVALID_ARGUMENT" in error_msg:
            raise HTTPException(
                status_code=400,
                detail="The image could not be processed by Gemini. Please try a different photo.",
            )
        raise HTTPException(status_code=500, detail="Internal Server Error")
