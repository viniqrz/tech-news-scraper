# Implementation Plan: Social Media Content Repurposer

## Goal
Automatically generate ready-to-post content for LinkedIn based on the day's top news stories.

## Input
- Source: `extracted/markdown/YYYY-MM-DD.md`.

## Architecture

### 1. Content Selector
- **Action:** Identify the "Top 3" most interesting stories.
- **Logic:**
    - Heuristic: First 3 articles in the list (usually the most important).
    - AI: Ask LLM to "Pick the 3 most viral/impactful stories from this list."

### 2. Post Generator
- **Action:** Rewrite the selected summaries into a LinkedIn format.
- **Format:** Professional tone, slightly longer analysis, bullet points, engaging hook.
- **Prompting:** "You are a tech influencer. Write a LinkedIn post summarizing these 3 stories..."

### 3. Output
- **Root Directory:** `generated/posts/` (outside `src`).
- **Structure:** `generated/posts/<YYYY-MM-DD>/<slugified-post-title>/`
- **Files:**
    - `prompt.md`: The exact prompt sent to the LLM.
    - `response.md`: The generated LinkedIn post content.

## Implementation Steps
1.  [ ] **Generator Script**: Create `src/pipelines/social-media-content/generate_posts.js`.
2.  [ ] **Prompt Design**: Create prompt templates specific for LinkedIn.
3.  [ ] **Persistence Logic**:
    -   Create directory `generated/posts/YYYY-MM-DD/`.
    -   Generate a slug from the post title (e.g., "google-lessons-and-browser-mechanics").
    -   Save `prompt.md` and `response.md` in that specific folder.

## Dependencies
- `dotenv`
- `openai` (or `google-generative-ai`)