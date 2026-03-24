const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Please set GEMINI_API_KEY in .env file");
    process.exit(1);
}

async function refineSearchQuery(apiKey, topic) {
    try {
        const prompt = `
      You are a Wikipedia Search Expert.
      The user wants to find a Wikipedia article about: "${topic}".
      
      Convert the user's input into the *single best* English or Japanese search query to find the specific main article on Wikipedia.
      
      Rules:
      1. If the input is ambiguous (e.g. "backnumber" could be a band or issue), use the context (e.g. "backnumber:曲名" -> "back number (バンド)") to disambiguate.
      2. If the input is already good (e.g. "猫"), return it as is.
      3. Remove unnecessary suffixes like ":曲名", ":歴史" unless they help disambiguate (e.g. "Apple:会社" -> "Apple (企業)").
      4. Return ONLY the search query string. No JSON, no explanations.
      
      Input: "${topic}"
      Best Wikipedia Search Query:
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
        return text ? text.trim() : topic;

    } catch (e) {
        console.error("Refine Error:", e.response ? e.response.data : e.message);
        return topic; // Fallback to original
    }
}

(async () => {
    const testCases = [
        "backnumber：曲名",      // Ambiguous -> Band
        "Apple：企業",            // Ambiguous -> Company
        "Java：プログラミング",    // Ambiguous -> Language
        "猫",                     // Simple -> Simple
        "パリ：旅行",             // Simple Context -> City
        "キングダム：漫画"         // Media -> Manga
    ];

    console.log("Testing AI Query Refinement Robustness...\n");

    for (const test of testCases) {
        process.stdout.write(`Input: "${test}" ... `);
        const start = Date.now();
        const refined = await refineSearchQuery(API_KEY, test);
        const duration = Date.now() - start;
        console.log(`-> Refined: "${refined}" (${duration}ms)`);
        await new Promise(r => setTimeout(r, 1000)); // Rate limit
    }
})();
