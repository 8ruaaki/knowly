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
        const response = await axios.get(url, { params });
        const json = response.data;
        if (json.query && json.query.search) {
            console.log(`\n--- Results for "${topic}" ---`);
            json.query.search.forEach((r, i) => {
                console.log(`${i + 1}. [${r.title}] (Score: ${r.score}) - ${r.snippet.replace(/<[^>]+>/g, '').substring(0, 50)}...`);
            });
        } else {
            console.log(`No results for "${topic}"`);
        }
    } catch (e) {
        console.error(e.message);
    }
}

(async () => {
    await searchWikipedia("backnumber：曲名");
    await searchWikipedia("backnumber");
})();
