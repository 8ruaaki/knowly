const axios = require('axios');

async function searchWikipedia(topic) {
    const url = "https://ja.wikipedia.org/w/api.php";
    const params = {
        action: "query",
        list: "search",
        srsearch: topic,
        format: "json",
        srlimit: 10
    };

    try {
        const response = await axios.get(url, {
            params,
            headers: { 'User-Agent': 'KnowlyQuizBot/1.0 (test@example.com)' }
        });
        const json = response.data;
        if (json.query && json.query.search) {
            console.log(`\n--- Results for "${topic}" ---`);
            if (json.query.search.length === 0) {
                console.log("(No results found)");
            } else {
                // Log top 3
                json.query.search.slice(0, 3).forEach((r, i) => {
                    console.log(`${i + 1}. ${r.title} (PageID: ${r.pageid})`);
                    console.log(`   Snippet: ${r.snippet.replace(/<[^>]+>/g, '')}`);
                });

                // Simulate Strict Logic
                const topResult = json.query.search[0];
                const normalize = s => s.toLowerCase().replace(/\s+/g, "");
                const topicNorm = normalize(topic);
                const titleNorm = normalize(topResult.title);

                if (topicNorm === titleNorm || titleNorm.includes(topicNorm) || topicNorm.includes(titleNorm)) {
                    console.log(`[STRICT MODE] Match found! Using ONLY top result: ${topResult.title}`);
                } else {
                    console.log(`[STRICT MODE] No direct match. Using top 3.`);
                }
            }
        } else {
            console.log(`No results for "${topic}"`);
        }
    } catch (e) {
        console.error(e.message);
    }
}

(async () => {
    const originalQueries = [
        "backnumber：曲名",
        "backnumber:曲名"
    ];
    for (const q of originalQueries) {
        // Simulate AI Refinement
        const cleaned = "back number (バンド)";
        console.log(`\nOriginal: "${q}" -> Cleaned: "${cleaned}"`);
        await searchWikipedia(cleaned);
        await new Promise(r => setTimeout(r, 2000));
    }
})();
