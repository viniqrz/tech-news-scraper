const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const prettier = require('prettier');

// Generate array of dates for the last N days
function getLastNdays(n) {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < n; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        dates.push(dateStr);
    }
    
    return dates;
}

// Ensure directories exist
function ensureDirs() {
    const dirs = [
        path.join(__dirname, '../../extracted/html/tldr'),
        path.join(__dirname, '../../extracted/markdown/tldr'),
        path.join(__dirname, '../../extracted/plain-text/tldr'),
        path.join(__dirname, '../../extracted/screenshots/tldr'),
        path.join(__dirname, '../../extracted/videos/tldr')
    ];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// Extract only semantic text HTML tags (cleaned of scripts, styles, etc.)
function extractTextHtml(page) {
    return page.evaluate(() => {
        // Clone the body to avoid modifying the actual page
        const clone = document.body.cloneNode(true);
        
        // Remove non-text elements
        const removeSelectors = [
            'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
            'video', 'audio', 'img', 'picture', 'source', 'meta',
            'link', 'button', 'input', 'form', 'nav', 'footer', 'header'
        ];
        removeSelectors.forEach(sel => {
            clone.querySelectorAll(sel).forEach(el => el.remove());
        });
        
        // Remove elements with no text content
        clone.querySelectorAll('*').forEach(el => {
            if (!el.textContent.trim()) {
                el.remove();
            }
        });
        
        // Remove all attributes except href
        clone.querySelectorAll('*').forEach(el => {
            const attrs = [...el.attributes];
            attrs.forEach(attr => {
                if (attr.name !== 'href') {
                    el.removeAttribute(attr.name);
                }
            });
        });
        
        return clone.innerHTML;
    });
}

// Build markdown from HTML string
function buildMarkdownFromHtml(html) {
    // Simple HTML parser using regex for our structured HTML
    let markdown = '';
    
    // Extract title from h1
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = h1Match ? h1Match[1].trim() : 'TLDR Dev Newsletter';
    markdown += `# ${title}\n\n`;
    
    // Extract h2 (subtitle)
    const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    if (h2Match) {
        markdown += `*${h2Match[1].trim()}*\n\n`;
    }
    
    // Extract articles with their links and descriptions
    const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    let articleMatch;
    
    while ((articleMatch = articleRegex.exec(html)) !== null) {
        const articleHtml = articleMatch[1];
        
        // Extract the main link and title (h3)
        const linkMatch = articleHtml.match(/<a\s+href="([^"]+)"[^>]*>\s*<h3[^>]*>([^<]+)<\/h3>/i);
        if (linkMatch) {
            const href = linkMatch[1];
            const linkTitle = linkMatch[2].replaceAll(/\s+/g, ' ').trim(); // remove linebreaks
            markdown += `### [${linkTitle}](${href})\n\n`;
        }
        
        // Extract description from div
        const divMatch = articleHtml.match(/<div[^>]*>([\s\S]*?)<\/div>/i);
        if (divMatch) {
            // Strip HTML tags from description, but preserve links
            let description = divMatch[1]
                .replace(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '[$2]($1)')
                .replace(/<[^>]+>/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            
            if (description) {
                markdown += `${description}\n\n`;
            }
        }
    }
    
    return markdown;
}

// Parse CLI flags
// Parse CLI flags
const args = process.argv.slice(2);
const RECORD_VIDEO = args.includes('--video');
const TAKE_SCREENSHOTS = args.includes('--screenshots');
const HEADLESS = args.includes('--headless') || !process.env.DISPLAY; // Auto-headless in Docker/CI

// Parse days argument (default 10)
const daysArgIndex = args.indexOf('--days');
const DAYS_TO_SCRAPE = daysArgIndex !== -1 ? parseInt(args[daysArgIndex + 1], 10) : 10;

(async () => {
    ensureDirs();
    
    const browser = await chromium.launch({ 
        headless: HEADLESS, 
        slowMo: 0,
        args: [
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        ]
    });
    
    // Create context (with optional video recording)
    const videosDir = path.join(__dirname, '../../extracted/videos/tldr');
    const contextOptions = RECORD_VIDEO ? {
        recordVideo: {
            dir: videosDir,
            size: { width: 1280, height: 720 }
        }
    } : {};
    const context = await browser.newContext(contextOptions);

    const page = await context.newPage();
    const dates = getLastNdays(DAYS_TO_SCRAPE);
    
    console.log(`Options: video=${RECORD_VIDEO}, screenshots=${TAKE_SCREENSHOTS}, days=${DAYS_TO_SCRAPE}`);
    
    console.log(`Starting scrape for last 30 days from tldr.tech/dev...\n`);
    
    let scrapedCount = 0;
    let skippedCount = 0;
    
    for (const date of dates) {
        const url = `https://tldr.tech/dev/${date}`;
        const timestamp = Date.now();
        
        try {
            console.log(`[${date}] Navigating to ${url}...`);
            await page.goto(url, { waitUntil: 'networkidle' });
            
            // Check if redirected to homepage
            const currentUrl = page.url();
            if (currentUrl === 'https://tldr.tech/' || !currentUrl.includes(date)) {
                console.log(`[${date}] ⚠️  Redirected to homepage - skipping (no content)\n`);
                skippedCount++;
                continue;
            }
            
            console.log(`[${date}] ✓ Valid page found`);
            
            // Save screenshot (optional, non-blocking)
            if (TAKE_SCREENSHOTS) {
                try {
                    const screenshotPath = path.join(__dirname, `../../extracted/screenshots/tldr/${date}-${timestamp}.png`);
                    await page.screenshot({ path: screenshotPath, timeout: 10000 });
                    console.log(`[${date}] Screenshot saved`);
                } catch (e) {
                    console.log(`[${date}] ⚠️  Screenshot skipped (timeout)`);
                }
            }

            // Save plain text
            const plainText = await page.evaluate(() => document.body.innerText);
            const textPath = path.join(__dirname, `../../extracted/plain-text/tldr/${date}.txt`);
            fs.writeFileSync(textPath, plainText, 'utf-8');
            console.log(`[${date}] Plain text saved`);
            
            // Save cleaned HTML (text tags only), formatted with Prettier
            const cleanHtml = await extractTextHtml(page);
            const formattedHtml = await prettier.format(cleanHtml, { parser: 'html' });
            const htmlPath = path.join(__dirname, `../../extracted/html/tldr/${date}.html`);
            fs.writeFileSync(htmlPath, formattedHtml, 'utf-8');
            console.log(`[${date}] Formatted HTML saved`);
            
            // Build markdown from the HTML
            const markdown = buildMarkdownFromHtml(formattedHtml);
            const mdPath = path.join(__dirname, `../../extracted/markdown/tldr/${date}.md`);
            fs.writeFileSync(mdPath, markdown, 'utf-8');
            console.log(`[${date}] Markdown saved\n`);
            
            scrapedCount++;
            
        } catch (error) {
            console.error(`[${date}] ❌ Error: ${error.message}\n`);
            skippedCount++;
        }
        
        // Small delay between requests to be polite
        await page.waitForTimeout(1000);
    }

    // Close the context to finalize video
    await context.close();
    
    // Rename video file
    const videoFiles = fs.readdirSync(videosDir).filter(f => f.endsWith('.webm'));
    if (videoFiles.length > 0) {
        const latestVideo = videoFiles.sort().pop();
        const oldPath = path.join(videosDir, latestVideo);
        const newPath = path.join(videosDir, `bulk-scrape-${Date.now()}.webm`);
        fs.renameSync(oldPath, newPath);
        console.log(`\nVideo saved to videos/${path.basename(newPath)}`);
    }
    
    await browser.close();
    
    console.log(`\n✨ Scraping complete!`);
    console.log(`   Scraped: ${scrapedCount} pages`);
    console.log(`   Skipped: ${skippedCount} pages (no content or errors)`);
})();
