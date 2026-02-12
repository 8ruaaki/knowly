const https = require('https');
const fs = require('fs');

const topic = "Universal Studios Japan : ジョーズ";

const searchWiki = (query, callback) => {
    const url = `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=10`;
    const options = {
        headers: { 'User-Agent': 'KnowlyQuizBot/1.0 (test@example.com)' }
    };
    https.get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => callback(JSON.parse(data)));
    });
};

searchWiki(topic, (json) => {
    const results = json.query.search;
    console.log("Original Top 3:");
    results.slice(0, 3).forEach(r => console.log(`- ${r.title}`));

    // Re-ranking Logic
    const tokens = topic.split(/[:\s]+/).filter(t => t.length > 0).map(t => t.toLowerCase());
    console.log("\nTokens:", tokens);

    results.forEach(r => {
        let score = 0;
        const text = (r.title + " " + r.snippet).toLowerCase();
        tokens.forEach(t => {
            if (text.includes(t)) score++;
        });
        r.score = score;
    });

    results.sort((a, b) => b.score - a.score);

    console.log("\nRe-ranked Top 3:");
    results.slice(0, 3).forEach(r => console.log(`- ${r.title} (Score: ${r.score})`));
});
