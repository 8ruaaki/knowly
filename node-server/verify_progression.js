const axios = require('axios');

async function testProgression() {
    try {
        console.log("Testing Level-up Logic (3/3 score)...");
        const res = await axios.get("http://localhost:3000/api", {
            params: {
                action: "update_progress",
                user_id: "debug_user",
                topic: "backnumber：曲名",
                level: 1,
                score: 3,
                answered_questions: "[]"
            }
        });

        console.log("Result:", JSON.stringify(res.data, null, 2));

        if (res.data.unlocked === true) {
            console.log("SUCCESS: Level 2 unlocked with 3/3.");
        } else {
            console.error("FAILURE: Level 2 NOT unlocked with 3/3.");
        }

        console.log("\nTesting Badge Logic (3/3 score at Level 10)...");
        const resBadge = await axios.get("http://localhost:3000/api", {
            params: {
                action: "update_progress",
                user_id: "badge_tester",
                topic: "backnumber：曲名",
                level: 10,
                score: 3,
                answered_questions: "[]"
            }
        });

        console.log("Badge Result:", JSON.stringify(resBadge.data, null, 2));

        if (resBadge.data.badge_awarded === true) {
            console.log("SUCCESS: Badge awarded with 3/3 at Level 10.");
        } else {
            console.error("FAILURE: Badge NOT awarded.");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

testProgression();
