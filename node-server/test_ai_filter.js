const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

// Mock Wiki Search Results for "backnumber"
const MOCK_RESULTS = [
    {
        title: "Back number",
        snippet: "back number（バックナンバー）は、日本のスリーピースロックバンド。"
    },
    {
        title: "マイナビ仙台レディース",
        snippet: "マイナビ仙台レディース（マイナビセンダイレディース、英: MYNAVI SENDAI LADIES）は、...背番号（back number）..."
    },
    {
        title: "クリスマスソング (back numberの曲)",
        snippet: "「クリスマスソング」は、日本のバンド・back numberのシングル。"
    }
];

async function selectRelevantArticles(apiKey, originalTopic, searchResults) {
    try {
        const candidatesText = searchResults.map((r, i) => `${i + 1}. [${r.title}] ${r.snippet.replace(/<[^>]+>/g, '')}`).join('\n');

        const prompt = `
      You are a helpful assistant assisting a quiz generator.
      The user is interested in: "${originalTopic}".
      
      We searched Wikipedia and found these candidates:
      ${candidatesText}
      
      Which of these articles are strictly relevant to the user's interest "${originalTopic}"?
      Ignore unrelated articles (e.g. if interest is a band, ignore "back number" meaning "old issue" or unrelated "Sendai Ladies" with back numbers).
      
      Return a JSON array of the 1-based indices of relevant articles.
      Example: [1] or [1, 3]
      If none are relevant, return [].
    `;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.0, response_mime_type: "application/json" }
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const text = response.data.candidates[0].content.parts[0].text;
        console.log("AI Response Raw:", text);
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return [];

    } catch (e) {
        console.error("AI Filter Error:", e.response ? e.response.data : e.message);
        return [];
    }
}

(async () => {
    const topic = "backnumber：曲名"; // Original Topic

    console.log(`Testing AI Filter for topic: "${topic}"`);
    console.log("Mock Candidates:", MOCK_RESULTS.map(r => r.title));

    const indices = await selectRelevantArticles(API_KEY, topic, MOCK_RESULTS);
    console.log("\nSelected Indices:", indices);

    const selected = MOCK_RESULTS.filter((_, i) => indices.includes(i + 1));
    console.log("Selected Titles:", selected.map(r => r.title));

    if (indices.includes(1) && !indices.includes(2)) {
        console.log("\nSUCCESS: Correctly selected Band and excluded Soccer Team.");
    } else {
        console.log("\nFAILURE: AI selection was incorrect.");
    }
})();
