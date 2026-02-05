// using native fetch

// URL from api.js
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzF48lElc8h2CL0R2FOjev7zncUteRuK8ND7xInFAtrE2QF29oIzQ6Q2saRrjEAvWT2/exec';

async function testBackend() {
    const testUser = {
        nickname: `test_user_${Date.now()}`,
        password: 'TestPassword123!',
        interests: ['Testing']
    };

    console.log('1. Testing Registration...');
    try {
        const formBody = new URLSearchParams();
        formBody.append('action', 'register_user');
        formBody.append('nickname', testUser.nickname);
        formBody.append('password', testUser.password);
        formBody.append('interests', JSON.stringify(testUser.interests));

        const regRes = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: formBody
        });
        const regData = await regRes.json();
        console.log('Registration Result:', regData);

        if (regData.status === 'success') {
            console.log('2. Testing Login...');
            const params = new URLSearchParams({
                action: 'login_user',
                nickname: testUser.nickname,
                password: testUser.password
            });
            const loginRes = await fetch(`${GAS_WEB_APP_URL}?${params}`);
            const loginData = await loginRes.json();
            console.log('Login Result:', loginData);
        } else {
            console.error('Skipping login test due to registration failure.');
        }

    } catch (error) {
        console.error('Connection Error:', error);
    }
}

testBackend();
