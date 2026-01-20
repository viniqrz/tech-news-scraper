const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { Readability } = require("@mozilla/readability");
const { JSDOM } = require("jsdom");
const TurndownService = require("turndown");
const fs = require("fs");
const path = require("path");
const slugify = require("slugify");

puppeteer.use(StealthPlugin());

const turndownService = new TurndownService();

// Helper to get formatted date YYYY-MM-DD
function getFormattedDate() {
  return new Date().toISOString().split("T")[0];
}

// Helper to ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Helper to get domain folder name (preserves dots)
function getDomainFolder(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "unknown-domain";
  }
}

// Helper to unwrap tracking links based on last https://
function cleanTrackingUrl(url) {
  const candidates = [url];

  try {
    candidates.unshift(decodeURIComponent(url));
  } catch (e) {
    // Ignore decode failures and fall back to raw url.
  }

  for (const candidate of candidates) {
    const httpsIndex = candidate.lastIndexOf("https://");
    if (httpsIndex !== -1) {
      return candidate.slice(httpsIndex);
    }

    const httpIndex = candidate.lastIndexOf("http://");
    if (httpIndex !== -1) {
      return candidate.slice(httpIndex);
    }
  }

  return url;
}

function stripTrackingParams(url) {
  try {
    const parsedUrl = new URL(url);
    const trackingKeys = new Set(["gclid", "fbclid", "mc_cid", "mc_eid"]);

    for (const key of Array.from(parsedUrl.searchParams.keys())) {
      if (key.startsWith("utm_") || trackingKeys.has(key)) {
        parsedUrl.searchParams.delete(key);
      }
    }

    return parsedUrl.toString();
  } catch (e) {
    return url;
  }
}

/**
 * Scrapes a single link and extracts content and child links.
 * @param {string} link - URL to scrape
 * @param {object} page - Puppeteer page instance
 * @param {Set<string>} visited - Set of already visited URLs to avoid cycles
 * @returns {Promise<{source: string, links: string[], files: {html: string, markdown: string, text: string, links: string}} | null>}
 */
async function scrapeSingleLink(link, page, visited) {
  const cleanedLink = stripTrackingParams(cleanTrackingUrl(link));

  // Skip if already visited
  if (visited.has(cleanedLink)) {
    return null;
  }
  visited.add(cleanedLink);

  try {
    console.log(`\nProcessing: ${cleanedLink}`);

    // Navigate
    await page.goto(cleanedLink, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Best-effort popup/paywall dismissal
    try {
      const closeSelectors = [
        '[aria-label="Close"]',
        '[data-testid="close"]',
        ".modal-close",
        ".close",
        'button[title="Close"]',
      ];

      for (const selector of closeSelectors) {
        const button = await page.$(selector);
        if (button) {
          await button.click({ delay: 50 });
          break;
        }
      }

      await page.keyboard.press("Escape");

      await page.evaluate(() => {
        const selectors = [".overlay", ".modal", ".paywall", ".popup"];
        selectors.forEach((selector) => {
          document
            .querySelectorAll(selector)
            .forEach((element) => element.remove());
        });
      });
    } catch (popupError) {
      console.warn(
        `Popup dismissal failed for ${cleanedLink}:`,
        popupError.message,
      );
    }

    if (typeof page.waitForTimeout === "function") {
      await page.waitForTimeout(500);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Get page content
    const content = await page.content();
    const title = await page.title();

    // Extract meaningful content using Readability
    const dom = new JSDOM(content, { url: cleanedLink });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      console.warn(`Could not extract article content for: ${cleanedLink}`);
      return null;
    }

    const articleTitle = article.title || title || "Untitled";
    const cleanHtml = article.content;
    const plainText = article.textContent;

    // Convert to Markdown
    const markdown = `
# ${articleTitle}

*Source: ${cleanedLink}*
*Date: ${getFormattedDate()}*

${turndownService.turndown(cleanHtml)}

Source: ${cleanedLink}
            `.trim();

    const articleDom = new JSDOM(cleanHtml, { url: cleanedLink });
    const articleLinks = new Set();

    articleDom.window.document.querySelectorAll("a[href]").forEach((node) => {
      try {
        const resolvedUrl = new URL(
          node.getAttribute("href"),
          cleanedLink,
        ).toString();
        const normalizedUrl = stripTrackingParams(
          cleanTrackingUrl(resolvedUrl),
        );

        if (
          normalizedUrl.startsWith("http://") ||
          normalizedUrl.startsWith("https://")
        ) {
          articleLinks.add(normalizedUrl);
        }
      } catch (e) {
        return;
      }
    });

    articleLinks.delete(cleanedLink);
    const childLinks = Array.from(articleLinks).sort();
    const linksText = childLinks.join("\n");

    // Prepare paths
    const domainFolder = getDomainFolder(cleanedLink);
    const dateStr = getFormattedDate();
    const titleSlug = slugify(articleTitle, {
      lower: true,
      strict: true,
      remove: /[*+~.()"'!:@]/g,
    }).substring(0, 100); // Limit length

    const baseDirs = {
      html: path.join(
        __dirname,
        `../../extracted/html/${domainFolder}/${dateStr}`,
      ),
      markdown: path.join(
        __dirname,
        `../../extracted/markdown/${domainFolder}/${dateStr}`,
      ),
      text: path.join(
        __dirname,
        `../../extracted/plain-text/${domainFolder}/${dateStr}`,
      ),
      links: path.join(
        __dirname,
        `../../extracted/links/${domainFolder}/${dateStr}`,
      ),
    };

    // Ensure directories
    Object.values(baseDirs).forEach(ensureDir);

    // Save files
    const fileName = titleSlug || "index";

    const files = {
      html: `html/${domainFolder}/${dateStr}/${fileName}.html`,
      markdown: `markdown/${domainFolder}/${dateStr}/${fileName}.md`,
      text: `plain-text/${domainFolder}/${dateStr}/${fileName}.txt`,
      links: `links/${domainFolder}/${dateStr}/${fileName}.links.txt`,
    };

    fs.writeFileSync(path.join(baseDirs.html, `${fileName}.html`), cleanHtml);
    fs.writeFileSync(path.join(baseDirs.markdown, `${fileName}.md`), markdown);
    fs.writeFileSync(path.join(baseDirs.text, `${fileName}.txt`), plainText);
    fs.writeFileSync(
      path.join(baseDirs.links, `${fileName}.links.txt`),
      linksText,
    );

    console.log(`✓ Saved content for "${articleTitle}"`);

    return {
      source: cleanedLink,
      links: childLinks,
      files,
    };
  } catch (error) {
    console.error(`❌ Error scraping ${cleanedLink}:`, error.message);
    return null;
  }
}

/**
 * Generic scraper that visits links using BFS, extracts content, and saves it in multiple formats.
 * @param {string[]} links - Array of URLs to scrape
 * @param {object} options - Scraping options
 * @param {number} [options.depth=1] - How many levels deep to scrape (1 = only provided links, 2 = also scrape child links, etc.)
 * @returns {Promise<{source: string, links: string[], files: {html: string, markdown: string, text: string, links: string}, children: Array}>}
 */
async function scrapeLinks(links, { depth = 1 } = {}) {
  const result = {
    source: null,
    links: [],
    files: {
      html: null,
      markdown: null,
      text: null,
      links: null,
    },
    children: [],
  };

  if (!links || links.length === 0) {
    console.log("No links provided to scrape.");
    return result;
  }

  console.log(`Starting generic scrape for ${links.length} links...`);
  if (depth > 1) {
    console.log(`BFS mode enabled with depth: ${depth}`);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1920,1080",
    ],
  });

  const page = await browser.newPage();

  // Set a realistic user agent just in case stealth needs help or for simple checks
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  );

  const visited = new Set();

  // BFS: Process level by level
  // Each level is an array of { parentResult, linksToProcess }
  let currentLevel = [{ parentResult: result, linksToProcess: links }];
  let currentDepth = 1;

  while (currentLevel.length > 0 && currentDepth <= depth) {
    console.log(`\n--- Processing depth level ${currentDepth} ---`);
    const nextLevel = [];

    for (const { parentResult, linksToProcess } of currentLevel) {
      for (const link of linksToProcess) {
        const scrapeResult = await scrapeSingleLink(link, page, visited);

        if (scrapeResult) {
          parentResult.source = scrapeResult.source;
          parentResult.links = scrapeResult.links;
          parentResult.files = scrapeResult.files;

          // If we have more depth to go, prepare child result node
          if (currentDepth < depth && scrapeResult.links.length > 0) {
            const childNode = {
              source: null,
              links: [],
              files: {
                html: null,
                markdown: null,
                text: null,
                links: null,
              },
              children: [],
            };
            parentResult.children.push(childNode);

            // Queue child links for next level
            nextLevel.push({
              parentResult: childNode,
              linksToProcess: scrapeResult.links,
            });
          }
        }
      }
    }

    currentLevel = nextLevel;
    currentDepth++;
  }

  await browser.close();
  console.log("\nGeneric scraping finished.");

  return result;
}

// Allow standalone execution if called directly
if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse flags
  const depthIndex = args.indexOf("--depth");

  let depth = 1;

  if (depthIndex !== -1 && args[depthIndex + 1]) {
    depth = parseInt(args[depthIndex + 1], 10) || 1;
  }

  // Filter out flags to get URLs
  const urls = args.filter((arg, i) => {
    if (arg === "--depth") return false;
    if (i > 0 && args[i - 1] === "--depth") return false;
    return true;
  });

  if (urls.length > 0) {
    scrapeLinks(urls, { depth }).then((result) => {
      console.log("\nResult:", JSON.stringify(result, null, 2));
    });
  } else {
    console.log(
      "Usage: node src/scrapers/generic.js [--depth N] <url1> <url2> ...",
    );
  }
}

module.exports = { scrapeLinks };
