# Implementation Plan: Trend Analysis Dashboard

## Goal
Visualize the popularity of technologies (e.g., React, Rust, AI, Security) mentioned in the newsletter over time.

## Input
- Source: All files in `extracted/markdown/`.

## Architecture

### 1. Data Extractor
- **Action:** Iterate through all historical Markdown files.
- **Logic:**
    - **Simple approach:** Regex matching for a predefined list of keywords (React, Vue, AI, LLM, Python, etc.).
    - **Advanced approach:** Use an NLP library (like `compromise` or `natural`) or an LLM to extract Named Entities (Technologies).
- **Output:** A JSON file `trends-data.json` structure:
    ```json
    [
      { "date": "2024-01-01", "react": 2, "ai": 5, "python": 1 },
      { "date": "2024-01-02", "react": 3, "ai": 4, "python": 0 }
    ]
    ```

### 2. Frontend / Visualization
- **Tool:** A lightweight web dashboard.
- **Stack:**
    - **HTML/JS:** Single index.html with embedded script.
    - **Chart Library:** `Chart.js` or `Recharts` (if using React).
    - **Hosting:** Local file open or simple static serve.

## Implementation Steps
1.  [ ] **Analyzer Script**: Create `src/pipelines/trend-dashboard/analyze_trends.js`.
    -   Scans `extracted/markdown`.
    -   Counts keywords.
    -   Generates `extracted/dashboard/data.json`.
2.  [ ] **Dashboard UI**: Create `src/pipelines/trend-dashboard/index.html`.
    -   Fetch `data.json`.
    -   Render Line Chart showing mentions over time.
3.  [ ] **Automation**: Run analysis after every scrape.

## Dependencies
- `chart.js` (CDN or npm)
