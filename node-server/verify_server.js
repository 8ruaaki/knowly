const axios = require('axios');

async function test() {
    try {
        console.log("Calling API...");
        const response = await axios.get("http://localhost:3000/api", {
            params: {
                action: "generate_quiz",
                topic: "backnumber：曲名",
                user_id: "debug_user",
                difficulty: 1
            }
        });

        console.log("Status:", response.status);
        console.log("Data:", JSON.stringify(response.data, null, 2));

        if (response.data.questions && response.data.questions.length === 3) {
            console.log("SUCCESS: 3 questions generated.");
        } else {
            console.warn("WARNING: Question count mismatch or error.");
        }

    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.error("Response:", e.response.data);
        }
    }
}

test();
