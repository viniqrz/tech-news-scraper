# Implementation Plan: AI-Powered Tech News Podcast

## Goal
Automate the creation of a daily 2-minute audio summary (MP3) from the scraped TLDR Dev newsletter.

## Input
- Source: `extracted/markdown/YYYY-MM-DD.md`
- Data: Headlines, summaries, and links.

## Architecture

### 1. Content Processor
- **Input:** Raw Markdown file.
- **Action:** 
    - Parse the Markdown to extract specific articles.
    - Filter out ads/sponsors if possible (look for "(Sponsor)" tags).
    - **Prompt Engineering:** Send the text to an LLM (e.g., Gemini 2.5 Flash or GPT-4o-mini) with a prompt to "rewrite this newsletter as a lively, engaging 2-minute podcast script for software engineers."

### 2. Audio Generation (TTS)
- **Input:** Generated script text.
- **Action:** Send text to a Text-to-Speech API.
- **Tools:**
    - **OpenAI API:** `tts-1` model (Cost-effective, good quality).
    - **ElevenLabs:** Higher quality, more voice options (Costlier).
    - **Edge-TTS:** Free, runs locally (lower quality but sufficient for MVP).

### 3. Audio Post-Processing (Optional)
- Add intro/outro music using `ffmpeg`.

## Implementation Steps
1.  [ ] **Setup API Keys**: Configure env vars for LLM and TTS provider.
2.  [ ] **Script Generator**: Create `src/pipelines/news-podcast/generate_script.js`.
    -   Reads the latest MD file.
    -   Calls LLM API.
    -   Outputs `script.txt`.
3.  [ ] **Audio Synthesizer**: Create `src/pipelines/news-podcast/synthesize_audio.js`.
    -   Reads `script.txt`.
    -   Calls TTS API.
    -   Saves `podcast-YYYY-MM-DD.mp3` to `extracted/podcasts/`.
4.  [ ] **Orchestrator**: Create a main runner script to chain these steps.

## Dependencies
- `openai` (or `google-generative-ai`)
- `dotenv`
