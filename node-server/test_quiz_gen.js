const axios = require('axios');

async function testQuizGen() {
  const TOPIC = process.argv[2] || "宇宙";
  const url = 'http://localhost:3000/api';
  const params = {
    action: 'generate_quiz',
    topic: TOPIC,
    difficulty: 1,
    user_id: 'debug_user_001'
  };

  console.log(`\nTesting Quiz Generation for topic: "${TOPIC}"...`);
  console.time("Generation Time");

  try {
    const response = await axios.post(url, params);
    console.timeEnd("Generation Time");
    
    const data = response.data;
    if (data.status === 'success') {
      console.log(`\n✅ SUCCESS! Generated ${data.questions.length} questions.`);
      console.log('--- Sample Question 1 ---');
      console.log('Q:', data.questions[0].question);
      console.log('A:', data.questions[0].options[data.questions[0].correct_index]);
      console.log('Exp:', data.questions[0].explanation);
    } else {
      console.error(`\n❌ FAILED: ${data.message}`);
      if (data.message.includes("checks")) {
        console.log("Suggestion: Check server logs for validation errors.");
      }
    }
  } catch (e) {
    console.timeEnd("Generation Time");
    console.error(`\n❌ NETWORK/SERVER ERROR: ${e.message}`);
    if (e.response) {
      console.error("Response Data:", e.response.data);
    }
  }
}

testQuizGen();
