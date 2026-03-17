# SnowTracker - Snowflake Lunch Macro Tracker

A Next.js web app for Snowflake employees to track their cafeteria meals. Select dishes from your work buffet, take a photo, and use Gemini AI to analyze nutritional macros.

## Quick Start

```bash
cd snow-tracker

# Install dependencies (already done)
bun install

# Add your Gemini API key
# Edit .env.local and add: GEMINI_API_KEY=your_key_from_https://aistudio.google.com/app/apikey

# Run development server
bun run dev

# Open http://localhost:3000 on your phone (use your computer's IP)
```

## Running on Your Phone

### Option 1: Same Network (Recommended)
```bash
# Start server
bun run dev

# Find your computer's IP
ifconfig | grep "inet "

# On your phone, open: http://YOUR_IP:3000
```

### Option 2: Tunnel (for remote access)
```bash
bun add -d tunnel
npx tunnel localhost:3000
```

## Tech Stack

- **Next.js 16** - React framework with App Router
- **Tailwind CSS** - Styling (same as web!)
- **Bun** - Package manager
- **Server-side scraping** - Fetches menus via API routes
- **Gemini Vision API** - Image analysis for macros

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/scrape` | GET | Fetches all station menus |
| `/api/analyze` | POST | Analyzes meal with Gemini |
| `/api/meals` | GET/POST | List or add meals |

## Project Structure

```
snow-tracker/
├── src/
│   ├── app/
│   │   ├── page.tsx       # Main UI
│   │   ├── layout.tsx     # Root layout
│   │   ├── globals.css    # Tailwind
│   │   └── api/
│   │       ├── scrape/   # Menu scraping
│   │       ├── analyze/   # AI analysis
│   │       └── meals/    # Meal storage
│   ├── services/
│   │   ├── scraper.ts    # Server-side scraping
│   │   └── gemini.ts     # Gemini API
│   ├── types/            # TypeScript types
│   └── constants/        # Station configs
└── .env.local           # API keys
```

## How It Works

1. **Menu Scraping** - Server fetches Sifted URLs, parses dishes/ingredients
2. **Meal Selection** - Select station & dishes on mobile UI
3. **Photo Capture** - Upload photo from phone camera
4. **AI Analysis** - Server sends image + ingredients to Gemini Vision API
5. **Storage** - In-memory storage (replace with database for production)

## Environment Variables

```bash
# .env.local
GEMINI_API_KEY=your_google_ai_studio_key
```

Get your key from: https://aistudio.google.com/app/apikey

## For Production

- Add a database (Vercel Postgres, Supabase, etc.) for meal storage
- Add authentication
- Deploy to Vercel: `npx vercel deploy`
