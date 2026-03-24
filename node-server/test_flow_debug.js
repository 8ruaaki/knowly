const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Please set GEMINI_API_KEY in .env file");
    process.exit(1);
}

// 1. Refine Query
async function refineSearchQuery(apiKey, topic) {
    console.log(`\n[1] Refining Query for: "${topic}"`);
    try {
        const prompt = `
      You are a Wikipedia Search Expert.
      The user wants to find a Wikipedia article about: "${topic}".
      Convert user input into the *single best* English or Japanese search query.
      Rules:
      1. If ambiguous, use context (e.g. "backnumber:曲名" -> "back number (バンド)").
      2. Return ONLY the search query string.
      
      Input: "${topic}"
    `;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.0 }
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        let text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        const refined = text ? text.trim() : topic;
        console.log(`    -> Refined to: "${refined}"`);
        return refined;

    } catch (e) {
        console.error("Refine Error:", e.message);
        return topic;
    }
}

// 2. Search Wikipedia
async function searchWikipedia(topic) {
    console.log(`\n[2] Searching Wikipedia for: "${topic}"`);
    const url = "https://ja.wikipedia.org/w/api.php";
    const params = {
        action: "query",
        list: "search",
        srsearch: topic,
        format: "json",
        srlimit: 5
    };

    try {
        const response = await axios.get(url, {
            params,
            headers: { 'User-Agent': 'KnowlyQuizBot/1.0 (test@example.com)' }
        });
        const results = response.data.query?.search || [];
        console.log(`    -> Found ${results.length} results.`);
        return results;
    } catch (e) {
        console.error("Wiki Search Error:", e.message);
        return [];
    }
}

// 3. Fetch Content
async function getWikipediaContent(title) {
    const url = "https://ja.wikipedia.org/w/api.php";
    const params = {
        action: "query",
        prop: "extracts",
        explaintext: true,
        titles: title,
        format: "json"
    };

    try {
        const response = await axios.get(url, { params, headers: { 'User-Agent': 'KnowlyQuizBot/1.0' } });
        const pages = response.data.query?.pages;
        const pageId = Object.keys(pages)[0];
        return pages[pageId]?.extract || "";
    } catch (e) {
        return "";
    }
}

// 4. Extract Keywords
async function extractKeywords(apiKey, content, originalTopic) {
    console.log(`\n[4] Extracting Keywords for: "${originalTopic}"`);
    try {
        const prompt = `
      You are a Quiz Topic Expert.
      The user is interested in: "${originalTopic}".
      We have found a main article about this entity.
      
      Extract 5 specific keywords, sub-topics, or related terms from the text that strictly match the user's specific interest.
      For example, if the user asks for "backnumber: Songs", list 5 song titles found in the text.
      
      Source Text (Truncated):
      """
      ${content.substring(0, 10000)}
      """
      
      Return ONLY a JSON array of strings.
      Example: ["Christmas Song", "Heroine", "Takane no Hanako-san", "Happy End", "Suiheisen"]
    `;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.0, response_mime_type: "application/json" }
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        let text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        // Clean markdown JSON block just in case
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        const json = JSON.parse(text);
        console.log(`    -> Extracted Keywords: ${JSON.stringify(json)}`);
        return json;

    } catch (e) {
        console.error("Keyword Extraction Error:", e.message);
        return [];
    }
}

(async () => {
    const topic = "backnumber：曲名"; // The problematic input

    // 1. Refine
    const refined = await refineSearchQuery(API_KEY, topic);

    // 2. Search
    const results = await searchWikipedia(refined);

    if (results.length > 0) {
        // 3. Get Content of Top Result (Main Entity)
        const mainEntity = results[0];
        console.log(`\n[3] Fetching Main Entity Content: "${mainEntity.title}"...`);
        const content = await getWikipediaContent(mainEntity.title);

        if (content) {
            // 4. Extract Keywords
            await extractKeywords(API_KEY, content, topic);
        }
    }
})();
