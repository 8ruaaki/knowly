const axios = require('axios');

async function testGenerateQuiz() {
  const url = 'http://localhost:3000/api';
  const params = {
    action: 'generate_quiz',
    topic: '東京', // Simple topic
    difficulty: 1,
    user_id: 'test_user'
  };

  try {
    console.log('--- Testing Quiz Generation (Fallback Check) ---');
    const response = await axios.post(url, params);
    const data = response.data;

    if (data.status === 'success') {
        console.log('SUCCESS: Quiz generated.');
        console.log(`Generated ${data.questions.length} questions.`);
        console.log('Sample Explanation:', data.questions[0].explanation);
    } else {
        console.error('FAIL:', data.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testGenerateQuiz();
