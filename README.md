# 📰 Tech News Scraper

A Playwright-based scraper that fetches the last 30 days of developer news from [TLDR.tech](https://tldr.tech/dev) and exports it in multiple formats.

## ✨ Features

- 🔄 Scrapes last 30 days of TLDR Dev newsletters
- 📄 Exports to **HTML**, **Markdown**, and **Plain Text**
- 🎬 Optional video recording of scraping session
- 📸 Optional screenshots of each page
- 🚀 Runs headless for fast, automated scraping

## 📁 Output Structure

```
extracted/
├── html/           # Cleaned, formatted HTML (Prettier)
├── markdown/       # Article links with descriptions
├── plain-text/     # Raw text content
├── screenshots/    # Page screenshots (optional)
└── videos/         # Session recordings (optional)
```

## 🐳 Quick Start with Docker

```bash
# Build and run (scrapes last 10 days)
docker build -t tech-news-scraper . && docker run -v $(pwd)/extracted:/app/extracted tech-news-scraper

# With screenshots
docker run -v $(pwd)/extracted:/app/extracted tech-news-scraper --screenshots

# With video recording
docker run -v $(pwd)/extracted:/app/extracted tech-news-scraper --video
```

## 💻 Local Development (It will be faster than Docker in the first run)

```bash
# Install dependencies
npm install

# Run scraper
node src/scripts/tldr.js

# With options
node src/scripts/tldr.js --screenshots --video --days 30
```

## ⚙️ CLI Options

| Flag | Description |
|------|-------------|
| `--days [n]` | Number of days to scrape (default: 10) |
| `--screenshots` | Take PNG screenshots of each page |
| `--video` | Record WebM video of scraping session |
| `--headless` | Run without browser UI (default in Docker) |

## 🛠️ Tech Stack

- **Playwright** - Browser automation
- **Prettier** - HTML formatting
- **Node.js** - Runtime

## 📄 License

MIT
