const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const slugify = require('slugify');

// Load environment variables
dotenv.config();

// Configuration
const MARKDOWN_DIR = path.join(__dirname, '../../../extracted/markdown');
const GENERATED_DIR = path.join(__dirname, '../../../generated/posts');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getLatestMarkdownFile() {
    try {
        const files = fs.readdirSync(MARKDOWN_DIR)
            .filter(file => file.endsWith('.md') && !file.startsWith('example'))
            .sort()
            .reverse(); // Newest first

        if (files.length === 0) {
            throw new Error('No markdown files found in ' + MARKDOWN_DIR);
        }

        return path.join(MARKDOWN_DIR, files[0]);
    } catch (error) {
        console.error('Error finding markdown files:', error.message);
        process.exit(1);
    }
}

async function generatePost(content, retries = 3) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are a top-tier Tech Influencer on LinkedIn. Your audience consists of software engineers, developers, and tech founders.
Your goal is to create a viral, high-value LinkedIn post based on the tech news provided below.

INSTRUCTIONS:
1. Analyze the provided newsletter content.
2. Select the TOP 3 most impactful, interesting, or controversial stories.
3. Write a LinkedIn post that includes:
    - A catchy, scroll-stopping "Hook" (first line).
    - A professional but engaging analysis of the 3 selected stories. Use bullet points or emojis to make it readable.
    - A brief "Takeaway" or "thought-provoking question" at the end to drive engagement.
    - 3-5 relevant hashtags.
4. Generate a short, descriptive Title for this post (will be used for file naming, not displayed in the post).

OUTPUT FORMAT:
You MUST return ONLY a valid JSON object with the following structure:
{
  "title": "Short Title Here",
  "postContent": "The full LinkedIn post text here..."
}

NEWSLETTER CONTENT:
${content}
    `;

    console.log('🤖 Generating content with Gemini...');
    
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // clean up code blocks if the model wraps json in ```json ... ```
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return {
            prompt: prompt,
            data: JSON.parse(cleanedText)
        };
    } catch (error) {
        if (error.status === 429 && retries > 0) {
             const delay = 20000; // Wait 20 seconds
             console.log(`⚠️ Rate limit hit. Retrying in ${delay/1000}s... (${retries} retries left)`);
             await new Promise(resolve => setTimeout(resolve, delay));
             return generatePost(content, retries - 1);
        }
        
        console.error('❌ API Error:', error.message);
        console.log('⚠️  Falling back to MOCK mode to demonstrate output structure.');
        
        return {
            prompt: prompt,
            data: {
                title: "Mock Title For Demonstration",
                postContent: "This is a MOCK response because the API quota was exceeded.\n\n🚀 **Hook:** Imagine this is a catchy hook!\n\n* **Story 1:** Analysis of story 1.\n* **Story 2:** Analysis of story 2.\n* **Story 3:** Analysis of story 3.\n\n🤔 **Takeaway:** What do you think?\n\n#Tech #News #Mock"
            }
        };
    }
}

function saveGeneratedPost(dateStr, title, prompt, postContent) {
    const slug = slugify(title, { lower: true, strict: true });
    const postDir = path.join(GENERATED_DIR, dateStr, slug);

    if (!fs.existsSync(postDir)) {
        fs.mkdirSync(postDir, { recursive: true });
    }

    // Save Prompt
    fs.writeFileSync(path.join(postDir, 'prompt.md'), prompt, 'utf-8');
    
    // Save Response
    fs.writeFileSync(path.join(postDir, 'response.md'), postContent, 'utf-8');

    console.log(`\n✅ Post saved successfully!`);
    console.log(`📁 Directory: ${postDir}`);
    console.log(`📄 Files: prompt.md, response.md`);
}

(async () => {
    // 1. Check API Key
    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ Error: GEMINI_API_KEY not found in environment variables.');
        console.error('   Please create a .env file with your API key.');
        process.exit(1);
    }

    try {
        // 2. Get latest file
        const filePath = await getLatestMarkdownFile();
        const fileName = path.basename(filePath);
        const dateStr = fileName.replace('.md', '');
        console.log(`📖 Reading input file: ${fileName}`);

        const content = fs.readFileSync(filePath, 'utf-8');

        // 3. Generate Post
        const { prompt, data } = await generatePost(content);

        // 4. Save
        saveGeneratedPost(dateStr, data.title, prompt, data.postContent);

    } catch (error) {
        console.error('❌ specific error:', error);
        process.exit(1);
    }
})();
