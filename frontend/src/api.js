const MOCK_API = false; // Toggle this to switch between Mock and Real

const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyTdBLUI42TBh4LFTXASunbNayUURebTnyUDR0N-ER25GJZNiBgV3oTjoy6ynryjRcvqg/exec'; // User replaces this

// Mock Data
const MOCK_QUIZ = {
    quiz_id: 'q_mock_1',
    question: 'Which K-pop group is known as the "Kings of K-pop"?',
    options: ['BTS', 'BIGBANG', 'EXO'],
    correct_option: 1,
    type: 'choice'
};

const MOCK_USER = {
    user_id: 'u_1',
    nickname: 'Haru',
    interests: ['K-pop', 'Coffee', 'AI'],
    badges: []
};

// API Functions
export const api = {
    getQuiz: async (userId, topic, difficulty = 1) => {
        if (MOCK_API) {
            console.log(`Fetching mock quiz for: ${topic} (Level ${difficulty})`);
            return new Promise(resolve => setTimeout(() => resolve({
                status: 'success',
                questions: Array(5).fill(null).map((_, i) => ({
                    question: `Level ${difficulty} Question ${i + 1} about ${topic}?`,
                    options: ['Option A', 'Option B', 'Option C', 'Option D'],
                    correct_index: 0,
                    explanation: `Explanation for Level ${difficulty} question.`
                }))
            }), 1500));
        }
        const params = new URLSearchParams({ action: 'generate_quiz', user_id: userId, topic, difficulty });
        const res = await fetch(`${GAS_WEB_APP_URL}?${params}`);
        return res.json();
    },
    getTopicProgress: async (userId, topic) => {
        if (MOCK_API) return { status: 'success', max_level: 1 };
        const params = new URLSearchParams({ action: 'get_topic_progress', user_id: userId, topic });
        const res = await fetch(`${GAS_WEB_APP_URL}?${params}`);
        return res.json();
    },
    updateProgress: async (userId, topic, level, score) => {
        if (MOCK_API) return { status: 'success', unlocked: score >= 5 };
        const params = new URLSearchParams({
            action: 'update_progress',
            user_id: userId,
            topic,
            level,
            score
        });
        const res = await fetch(`${GAS_WEB_APP_URL}?${params}`);
        return res.json();
    },
    refineInterest: async (interest, history = []) => {
        if (MOCK_API) return { status: 'specific', refined_topic: interest };
        const params = new URLSearchParams({
            action: 'refine_interest',
            interest,
            history: JSON.stringify(history)
        });
        const res = await fetch(`${GAS_WEB_APP_URL}?${params}`);
        return res.json();
    },

    registerUser: async (userData) => {
        if (MOCK_API) {
            console.log('Mock Registration:', userData);
            return new Promise(resolve => setTimeout(() => resolve({ status: 'success', user_id: 'mock_u_1' }), 1000));
        }

        // POST request for registration to handle large payload (image)
        const formBody = new URLSearchParams();
        formBody.append('action', 'register_user');
        formBody.append('nickname', userData.nickname);
        formBody.append('password', userData.password);
        formBody.append('interests', JSON.stringify(userData.interests));

        if (userData.avatar_base64) {
            formBody.append('avatar_base64', userData.avatar_base64);
            formBody.append('avatar_mimeType', userData.avatar_mimeType);
        }

        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: formBody
        });
        return res.json();
    },

    loginUser: async (credentials) => {
        if (MOCK_API) {
            console.log('Mock Login:', credentials);
            return new Promise(resolve => setTimeout(() => resolve({
                status: 'success',
                user_id: 'mock_u_1',
                nickname: credentials.nickname,
                avatar_url: null,
                interests: '["Mock Interest"]'
            }), 1000));
        }

        const params = new URLSearchParams({
            action: 'login_user',
            nickname: credentials.nickname,
            password: credentials.password
        });
        const res = await fetch(`${GAS_WEB_APP_URL}?${params}`);
        return res.json();
    },

    submitAnswer: async (quizId, answer) => {
        if (MOCK_API) {
            return new Promise(resolve => setTimeout(() => resolve({
                correct: MOCK_QUIZ.correct_option === answer,
                feedback: MOCK_QUIZ.correct_option === answer ? "Spot on! BIGBANG laid the foundation." : "Interesting guess, but BIGBANG is the classic answer."
            }), 800));
        }
        const params = new URLSearchParams({ action: 'submit_answer', quiz_id: quizId, answer });
        const res = await fetch(`${GAS_WEB_APP_URL}?${params}`, { method: 'POST' });
        return res.json();
    },

    getExploreInterests: async (userId) => {
        if (MOCK_API) {
            return new Promise(resolve => setTimeout(() => resolve({
                status: 'success',
                interests: ['Mock K-pop', 'Mock Coffee', 'Mock UI/UX', 'Mock Travel']
            }), 800));
        }
        const params = new URLSearchParams({ action: 'get_explore_interests', user_id: userId });
        const res = await fetch(`${GAS_WEB_APP_URL}?${params}`);
        return res.json();
    },

    searchUsers: async (query, userId) => {
        if (MOCK_API) {
            return new Promise(resolve => setTimeout(() => resolve({
                status: 'success',
                users: [
                    { user_id: 'u_mock_2', nickname: 'MockUserB', avatar_url: '', is_following: false },
                    { user_id: 'u_mock_3', nickname: 'MockUserC', avatar_url: '', is_following: true }
                ]
            }), 600));
        }
        const params = new URLSearchParams({ action: 'search_users', query, user_id: userId });
        const res = await fetch(`${GAS_WEB_APP_URL}?${params}`);
        return res.json();
    },

    toggleFollow: async (followerId, followingId) => {
        if (MOCK_API) {
            return Promise.resolve({ status: 'success' });
        }
        const params = new URLSearchParams({
            action: 'toggle_follow',
            follower_id: followerId,
            following_id: followingId
        });
        const res = await fetch(`${GAS_WEB_APP_URL}?${params}`, { method: 'POST' });
        return res.json();
    },

    getFollowing: async (userId) => {
        if (MOCK_API) {
            return new Promise(resolve => setTimeout(() => resolve({
                status: 'success',
                users: [
                    { user_id: 'u_mock_3', nickname: 'MockUserC', avatar_url: '', is_following: true }
                ]
            }), 600));
        }
        const params = new URLSearchParams({ action: 'get_following', user_id: userId });
        const res = await fetch(`${GAS_WEB_APP_URL}?${params}`);
        return res.json();
    },

    getUser: async (userId) => {
        if (MOCK_API) {
            return new Promise(resolve => setTimeout(() => resolve(MOCK_USER), 500));
        }
        const params = new URLSearchParams({ action: 'get_user', user_id: userId });
        const res = await fetch(`${GAS_WEB_APP_URL}?${params}`);
        return res.json();
    },

    updateProfile: async (userId, profileData) => {
        if (MOCK_API) {
            return new Promise(resolve => setTimeout(() => resolve({ status: 'success' }), 1000));
        }
        const formBody = new URLSearchParams();
        formBody.append('action', 'update_profile');
        formBody.append('user_id', userId);
        formBody.append('nickname', profileData.nickname);
        formBody.append('interests', JSON.stringify(profileData.interests));

        if (profileData.avatar_base64) {
            formBody.append('avatar_base64', profileData.avatar_base64);
            formBody.append('avatar_mimeType', profileData.avatar_mimeType);
        }

        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: formBody
        });
        return res.json();
    }
};
