# Love N Fit — Virtual Try-On

AI-powered virtual try-on app that lets you upload a photo (or take one directly on mobile), enter your body height and weight, find Vuori clothing products via a RAG chatbot, and see a virtual try-on of the chosen product on you — with the right size recommendation.

## Screenshots

### Upload & Chat
Upload your photo or take a picture directly on your phone, enter your body height and weight, and chat with the AI shopping assistant to find the perfect product.

![Upload and Chat](screenshots/image1.png)

### Try-On Result
See a virtual try-on of the chosen product on you with the right size, along with product details and available sizes.

![Try-On Result](screenshots/image2.png)

### Try-On History
Browse all your previous try-on results in a visual grid.

![Try-On History](screenshots/image3.png)

## Features

- Upload a photo or take a picture directly on mobile + enter body height/weight
- **RAG chatbot** powered by FAISS + Gemini embeddings searches 2,100+ Vuori products
- AI-generated virtual try-on showing the chosen product on you in the right size
- Personalized **size recommendation** based on body measurements
- "Love it!" button opens the product page for easy purchasing
- Dark/light mode, try-on history

## Tech Stack

| Frontend | Backend | AI & Data |
|----------|---------|-----------|
| React + Vite | FastAPI | Google Gemini (image gen + text + embeddings) |
| Ant Design | Uvicorn | FAISS vector database (2,100+ products) |
| Tailwind CSS | Poetry (Python 3.12+) | BeautifulSoup (product scraping) |

## Setup

### 1. Clone

```bash
git clone https://github.com/gheniabla/love-n-fit.git
cd love-n-fit/Gen-AI-Virtual-Try-On-Clothes
```

### 2. Backend

```bash
cd backend
poetry install
```

Create `.env`:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Index products (first time only):

```bash
poetry run python -m scripts.index_products
```

Run the server:

```bash
poetry run uvicorn main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

```
POST /api/try-on    — Virtual try-on (person image + product URL + measurements)
POST /api/chat      — RAG chatbot (product search + recommendations)
```

## Project Structure

```
/frontend           # React + Ant Design + Tailwind UI
/backend
  /routers          # FastAPI endpoints (tryon, chat)
  /utils            # Vuori scraper, FAISS vector store
  /scripts          # Product indexing script
  /data             # FAISS index + products.json
```

## License

MIT
