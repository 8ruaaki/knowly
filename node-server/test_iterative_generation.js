const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Please set GEMINI_API_KEY");
    process.exit(1);
}

// 1. Refine (Same as before)
async function refineSearchQuery(apiKey, topic) {
    console.log(`\n[1] Refining Query for: "${topic}"`);
    try {
        const prompt = `Convert "${topic}" to best Wikipedia search query (Japanese). Return ONLY text.`;
        const response = await callGemini(apiKey, prompt);
        console.log(`    -> Refined: ${response}`);
        return response.trim();
    } catch (e) { return topic; }
}

// 2. Search (Same as before)
async function searchWikipedia(topic, limit = 5) {
    console.log(`    -> Searching Wiki for: "${topic}"`);
    const url = "https://ja.wikipedia.org/w/api.php";
    try {
        const response = await axios.get(url, {
            params: { action: "query", list: "search", srsearch: topic, format: "json", srlimit: limit },
            headers: { 'User-Agent': 'KnowlyQuizBot/1.0' }
        });
        return response.data.query?.search || [];
    } catch (e) { return []; }
}

// 3. Extract Keywords (Updated for 3 keywords)
async function extractKeywords(apiKey, content, originalTopic) {
    console.log(`\n[2] Extracting Keywords for: "${originalTopic}"`);
    try {
        const prompt = `
      Extract 3 specific keywords/sub-topics from text matching "${originalTopic}".
      Return JSON array of strings.
      Source: ${content.substring(0, 5000)}...
    `;
        const text = await callGemini(apiKey, prompt);
        const json = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
        console.log(`    -> Keywords: ${JSON.stringify(json)}`);
        return json;
    } catch (e) { return []; }
}

// 4. Select Best Article (New)
async function selectBestArticle(apiKey, keyword, results) {
    console.log(`\n[3b] Selecting best article for keyword: "${keyword}" from ${results.length} candidates`);
    if (results.length === 0) return null;
    if (results.length === 1) return results[0];

    try {
        const candidates = results.map((r, i) => `${i + 1}. ${r.title}: ${r.snippet.replace(/<[^>]+>/g, "")}`).join("\n");
        const prompt = `
      Which article best matches the keyword "${keyword}"?
      Candidates:
      ${candidates}
      
      Return ONLY the 1-based index (e.g. 1).
    `;
        const text = await callGemini(apiKey, prompt);
        const index = parseInt(text.trim());
        if (index > 0 && index <= results.length) {
            console.log(`    -> AI Selected: ${results[index - 1].title}`);
            return results[index - 1];
        }
        return results[0];
    } catch (e) { return results[0]; }
}

// Helper
async function callGemini(apiKey, prompt) {
    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.0 } }
    );
    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function getWikipediaContent(title) {
    const url = "https://ja.wikipedia.org/w/api.php";
    try {
        const response = await axios.get(url, {
            params: { action: "query", prop: "extracts", explaintext: true, titles: title, format: "json" },
            headers: { 'User-Agent': 'KnowlyQuizBot/1.0' }
        });
        const pages = response.data.query?.pages;
        return Object.values(pages)[0]?.extract || "";
    } catch (e) { return ""; }
}

// MAIN FLOW
(async () => {
    const topic = "backnumber：曲名";

    // Step 1: Refine & Find Main Entity
    const refined = await refineSearchQuery(API_KEY, topic);
    const mainResults = await searchWikipedia(refined, 1);
    if (mainResults.length === 0) return;

    const mainEntity = mainResults[0];
    const mainContent = await getWikipediaContent(mainEntity.title);

    // Step 2: Extract Keywords
    const keywords = await extractKeywords(API_KEY, mainContent, topic);

    // Step 3: Loop
    for (const keyword of keywords) {
        console.log(`\n--- Processing Keyword: ${keyword} ---`);

        // Search "RefinedTopic Keyword" (e.g. "back number Christmas Song")
        // NOTE: User said "backnumber: そのキーワード" but using refined "back number" is safer?
        // Let's use the Original Topic's entity name + keyword for query.
        // Actually user said "backnumber : そのキーワード".
        // Let's try constructing query: `${refined} ${keyword}`
        const subQuery = `${refined} ${keyword}`;

        const subResults = await searchWikipedia(subQuery, 2); // Fetch 2

        const bestArticle = await selectBestArticle(API_KEY, keyword, subResults);

        if (bestArticle) {
            console.log(`    -> Fetching Content for: ${bestArticle.title}`);
            // Generate Question logic would go here
        }
    }

})();
