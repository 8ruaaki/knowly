const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const db = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public')); // Serve uploaded images

// --- HELPER FUNCTIONS ---

// Mimic GAS Utilities
const Utilities = {
  getUuid: () => uuidv4(),
  base64Decode: (str) => Buffer.from(str, 'base64'),
  newBlob: (data, mimeType, name) => ({ data, mimeType, name })
};

// Mimic DriveApp (Save to local file system)
const DriveApp = {
  createFile: (blob) => {
    const filename = `${Date.now()}_${blob.name}`;
    const uploadDir = path.join(__dirname, 'public/uploads');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, blob.data);

    return {
      getId: () => filename,
      getUrl: () => `http://localhost:${PORT}/uploads/${filename}`,
      setSharing: () => { } // No-op locally
    };
  }
};

// Mimic UrlFetchApp using axios
const UrlFetchApp = {
  fetch: async (url, options = {}) => {
    try {
      const config = {
        method: options.method || 'get',
        url: url,
        headers: options.headers || {},
        data: options.payload || undefined
      };

      if (options.contentType) {
        config.headers['Content-Type'] = options.contentType;
      }

      const response = await axios(config);
      return {
        getResponseCode: () => response.status,
        getContentText: () => (typeof response.data === 'object' ? JSON.stringify(response.data) : response.data),
        getJson: () => response.data
      };
    } catch (error) {
      console.error(`Fetch Error: ${url}`, error.message);
      if (options.muteHttpExceptions) {
        return {
          getResponseCode: () => error.response ? error.response.status : 500,
          getContentText: () => error.response ? JSON.stringify(error.response.data) : error.message,
          getJson: () => error.response ? error.response.data : {}
        };
      }
      throw error;
    }
  },
  fetchAll: async (requests) => {
    // Process requests in parallel
    return Promise.all(requests.map(req => UrlFetchApp.fetch(req.url, req)));
  }
};


// --- CORE LOGIC (Ported from Code.js) ---

async function handleRequest(params) {
  const action = params.action;
  let result = {};

  try {
    if (action === 'get_quiz') {
      result = { status: "error", message: "Use generate_quiz instead" };
    } else if (action === 'submit_answer') {
      result = submitAnswer(params);
    } else if (action === 'register_user') {
      result = registerUser(params);
    } else if (action === 'login_user') {
      result = loginUser(params);
    } else if (action === 'get_user') {
      result = getUser(params);
    } else if (action === 'get_explore_interests') {
      result = getExploreInterests(params);
    } else if (action === 'search_users') {
      result = searchUsers(params);
    } else if (action === 'toggle_follow') {
      result = toggleFollow(params);
    } else if (action === 'get_following') {
      result = getFollowing(params);
    } else if (action === 'update_profile') {
      result = updateProfile(params);
    } else if (action === 'generate_quiz') {
      result = await generateQuiz(params); // Async!
    } else if (action === 'get_topic_progress') {
      result = getTopicProgress(params);
    } else if (action === 'update_progress') {
      result = updateProgress(params);
    } else if (action === 'refine_interest') {
      result = await refineInterest(params); // Async!
    } else if (action === 'get_user_badges') {
      result = getUserBadges(params);
    } else {
      result = { error: 'Invalid action' };
    }
  } catch (e) {
    console.error("Handler Error:", e);
    result = { error: e.toString() };
  }
  return result;
}

// --- User Registration with Image Upload ---
function registerUser(params) {
  try {
    const existingUser = db.users.find(u => String(u.nickname).trim() === String(params.nickname).trim());
    if (existingUser) {
      return { status: "error", message: "This nickname is already taken." };
    }

    let avatarUrl = "";
    if (params.avatar_base64) {
      const data = Utilities.base64Decode(params.avatar_base64);
      const blob = Utilities.newBlob(data, params.avatar_mimeType, "avatar_" + Date.now() + ".png"); // simple ext assumption
      const file = DriveApp.createFile(blob);
      avatarUrl = file.getUrl();
    }

    const userId = "u_" + Utilities.getUuid();
    const newUser = {
      user_id: userId,
      nickname: params.nickname,
      password: params.password,
      interests: params.interests,
      avatar_url: avatarUrl,
      created_at: new Date().toISOString()
    };

    db.users.append(newUser);

    return {
      status: "success",
      user_id: userId,
      nickname: params.nickname,
      avatar_url: avatarUrl
    };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function loginUser(params) {
  try {
    const user = db.users.find(u =>
      String(u.nickname).trim() === String(params.nickname).trim() &&
      String(u.password).trim() === String(params.password).trim()
    );

    if (user) {
      return {
        status: "success",
        user_id: user.user_id,
        nickname: user.nickname,
        interests: user.interests,
        avatar_url: user.avatar_url
      };
    }
    return { status: "error", message: "User not found or incorrect password" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getUser(params) {
  try {
    const user = db.users.find(u => u.user_id === params.user_id);
    if (user) {
      let interests = [];
      try {
        interests = JSON.parse(user.interests);
      } catch (e) { }

      return {
        status: "success",
        user_id: user.user_id,
        nickname: user.nickname,
        interests: interests,
        avatar_url: user.avatar_url
      };
    }
    return { status: "error", message: "User not found" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function updateProfile(params) {
  try {
    const userId = params.user_id;
    const user = db.users.find(u => u.user_id === userId);

    if (!user) return { status: "error", message: "User not found" };

    const updates = {};
    if (params.nickname) updates.nickname = params.nickname;
    if (params.interests) updates.interests = params.interests;

    let avatarUrl = "";
    if (params.avatar_base64) {
      const data = Utilities.base64Decode(params.avatar_base64);
      const blob = Utilities.newBlob(data, params.avatar_mimeType, "avatar_" + Date.now() + ".png");
      const file = DriveApp.createFile(blob);
      avatarUrl = file.getUrl();
      updates.avatar_url = avatarUrl;
    }

    db.users.update(u => u.user_id === userId, updates);

    return { status: "success", avatar_url: avatarUrl || user.avatar_url };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getTopicProgress(params) {
  try {
    const progress = db.progress.find(p => p.user_id === params.user_id && p.topic === params.topic);
    return { status: "success", max_level: progress ? Number(progress.max_level) : 1 };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function updateProgress(params) {
  try {
    const userId = params.user_id;
    const topic = params.topic;
    const currentLevel = Number(params.level);
    const score = Number(params.score);
    const answeredQuestionsJSON = params.answered_questions;

    // 1. Save Answered Questions History
    if (answeredQuestionsJSON) {
      try {
        const answeredQuestions = JSON.parse(answeredQuestionsJSON);
        if (answeredQuestions && Array.isArray(answeredQuestions) && answeredQuestions.length > 0) {
          const timestamp = new Date().toISOString();
          answeredQuestions.forEach(q => {
            db.history.append({ user_id: userId, topic, question_text: q, created_at: timestamp });
          });
        }
      } catch (e) {
        console.error("Failed to save history: " + e.toString());
      }
    }

    if (score < 5) {
      return { status: "success", unlocked: false };
    }

    const progress = db.progress.find(p => p.user_id === userId && p.topic === topic);
    const currentMax = progress ? Number(progress.max_level) : 1;

    let badgeAwarded = false;
    if (Number(currentLevel) === 10 && Number(score) === 5) {
      badgeAwarded = awardBadge(userId, topic);
    }

    if (currentLevel === currentMax && currentMax < 10) {
      const newMax = currentMax + 1;
      if (!progress) {
        db.progress.append({ user_id: userId, topic, max_level: newMax, updated_at: new Date().toISOString() });
      } else {
        db.progress.update(p => p.user_id === userId && p.topic === topic, { max_level: newMax, updated_at: new Date().toISOString() });
      }
      return { status: "success", unlocked: true, new_max_level: newMax, badge_awarded: badgeAwarded };
    }

    return { status: "success", unlocked: false, badge_awarded: badgeAwarded };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function awardBadge(userId, topic) {
  try {
    const existing = db.badges.find(b => b.user_id === userId && b.topic === topic);
    if (existing) return false;

    db.badges.append({ user_id: userId, topic, awarded_at: new Date().toISOString() });
    return true;
  } catch (e) {
    return false;
  }
}

function getUserBadges(params) {
  try {
    const badges = db.badges.filter(b => b.user_id === params.user_id);
    return { status: "success", badges };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getAnsweredQuestions(userId, topic) {
  try {
    return db.history.filter(h => h.user_id === userId && h.topic === topic).map(h => h.question_text);
  } catch (e) {
    return [];
  }
}

// --- QUIZ GENERATION (Async) ---

// --- HELPER FUNCTIONS FOR ROBUST GENERATION ---

async function validateCandidates(apiKey, candidates, wikiData) {
  // We will run 3 checks per candidate.
  // To optimize, we can run them in parallel batches using UrlFetchApp.fetchAll
  // Request structure: [ Q1_Check1, Q1_Check2, Q1_Check3, Q2_Check1, ... ]

  // Pre-filter invalid candidates to ensure safety
  candidates = candidates.filter(q => q && q.options && Array.isArray(q.options));

  // Truncate content for validation (a bit shorter than generation to save cost/latency)
  const truncatedContent = wikiData.content.substring(0, 15000);

  const requests = [];

  candidates.forEach(q => {
    // Correct Answer Text
    const correctOption = q.options.find(o => o.is_correct)?.text || "Unknown";
    const distractors = q.options.filter(o => !o.is_correct).map(o => o.text).join(", ");

    // 1. Self-Correction / Uncertainty Check
    const prompt1 = `
      Question: ${q.question}
      Proposed Answer: ${correctOption}
      
      Verify this question against the following text ONLY.
      SOURCE TEXT:
      """
      ${truncatedContent}
      """

      Is the proposed answer strictly supported by the text?
      Return JSON: { "confident": boolean, "reason": "string" }
    `;
    requests.push({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt1 }] }],
        generationConfig: { temperature: 0.0, response_mime_type: "application/json" }
      })
    });

    // 2. AI Teacher / Judge
    const prompt2 = `
      You are a strict quiz editor. Review this question.
      SOURCE TEXT:
      """
      ${truncatedContent}
      """

      Question: ${q.question}
      Correct Answer: ${correctOption}
      Distractors: ${distractors}
      Explanation: ${q.explanation}
      
      Verify facts based ONLY on the Source Text provided above.
      Check for:
      1. Factuality (Is it true according to the text?)
      2. Clarity (Is it unambiguous?)
      3. Distractor Quality (Are they clearly wrong based on the text?)
      4. Trivia Quality (Reject questions that just ask "What is the article title?" or "What is this text about?". Ensure it tests specific knowledge.)
      
      Return JSON: { "pass": boolean, "reason": "string" }
    `;
    requests.push({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt2 }] }],
        generationConfig: { temperature: 0.0, response_mime_type: "application/json" }
      })
    });

    // 3. Reverse Generation (Solver)
    // Provide question and shuffled options (blind to correctness)
    const allOptions = q.options.map(o => o.text).sort(() => 0.5 - Math.random());
    const prompt3 = `
      Solve this quiz question based ONLY on the following text.
      SOURCE TEXT:
      """
      ${truncatedContent}
      """

      Question: ${q.question}
      Options: ${allOptions.join(", ")}
      
      Return JSON: { "predicted_answer": "string (exact text from options)" }
    `;
    requests.push({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt3 }] }],
        generationConfig: { temperature: 0.0, response_mime_type: "application/json" }
      })
    });
  });

  console.log(`Running ${requests.length} validation checks...`);

  try {
    const responses = await UrlFetchApp.fetchAll(requests);
    const validBatch = [];

    // Process responses in groups of 3
    for (let i = 0; i < candidates.length; i++) {
      if (responses.length <= i * 3 + 2) {
        console.warn(`Validation skipped for Q${i + 1}: incomplete responses`);
        continue;
      }
      const q = candidates[i];
      const correctOption = q.options.find(o => o.is_correct)?.text;

      // Parse Responses
      const r1 = parseGeminiJSON(responses[i * 3]);     // Uncertainty
      const r2 = parseGeminiJSON(responses[i * 3 + 1]);   // Teacher
      const r3 = parseGeminiJSON(responses[i * 3 + 2]);   // Solver

      const check1 = r1?.confident === true;
      const check2 = r2?.pass === true;
      // Solver check: Predicted answer should roughly match correct option
      const predicted = r3?.predicted_answer || "";
      const check3 = predicted.includes(correctOption) || correctOption.includes(predicted);

      console.log(`Q${i + 1} Checks: Self=${check1}, Judge=${check2}, Solver=${check3} (${predicted} vs ${correctOption})`);

      // RELAXED MODE: Majority vote (2 out of 3) OR Judge Pass (Teacher Authority)
      const score = (check1 ? 1 : 0) + (check2 ? 1 : 0) + (check3 ? 1 : 0);

      if (score >= 2 || check2) {
        validBatch.push(q);
      } else {
        console.warn(`Q${i + 1} Rejected: ${q.question.substring(0, 30)}...`);
      }
    }
    return validBatch;

  } catch (e) {
    console.error("Validation Error: " + e.toString());
    // In case of error, return original candidates (fail-open)
    return candidates;
  }
}

function parseGeminiJSON(response) {
  try {
    if (!response || response.getResponseCode() !== 200) return null;
    const json = response.getJson();
    let text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

async function generateQuiz(params) {
  try {
    const topic = params.topic || "General Knowledge";
    const difficulty = params.difficulty || 1;
    const userId = params.user_id;

    const answeredQuestions = getAnsweredQuestions(userId, topic);
    let exclusionText = "";
    if (answeredQuestions.length > 0) {
      exclusionText = `
      EXCLUDED QUESTIONS (Do NOT repeat these):
      ${answeredQuestions.map(q => `- ${q}`).join('\n')}
      `;
    }

    const TARGET_COUNT = 5;
    let validQuestions = [];
    let attempts = 0;
    const MAX_ATTEMPTS = 2;

    // Hacky reload for dev environment
    require('dotenv').config({ override: true });
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.includes("YOUR_API_KEY")) {
      return { status: "error", message: "GEMINI_API_KEY not configured" };
    }

    const searchResults = await searchWikipedia(topic);
    if (!searchResults || searchResults.length === 0) {
      return { status: "error", message: "No Wikipedia results found for: " + topic };
    }

    const index = Math.floor(Math.random() * Math.min(searchResults.length, 3));
    const targetArticle = searchResults[index];
    const wikiData = await getWikipediaContent(targetArticle.title);

    if (!wikiData || !wikiData.content) {
      return { status: "error", message: "Failed to retrieve content from Wikipedia." };
    }

    while (validQuestions.length < TARGET_COUNT && attempts < MAX_ATTEMPTS) {
      attempts++;
      const needed = TARGET_COUNT - validQuestions.length;
      const countToGenerate = needed + 2;

      console.log(`Attempt ${attempts}: Generating ${countToGenerate} candidates for ${needed} slots.`);

      const candidates = await generateCandidates(apiKey, topic, difficulty, exclusionText, countToGenerate, wikiData);

      if (candidates.length === 0) continue;

      // Validate candidates (Added missing call in server.js)
      const validatedBatch = await validateCandidates(apiKey, candidates, wikiData);

      // 1. Add Validated Questions First (High Quality)
      for (const q of validatedBatch) {
        if (validQuestions.length < TARGET_COUNT) {
          const shuffled = shuffleOptions(q);
          validQuestions.push(shuffled);
        }
      }

      // 2. Fallback: If we still don't have enough, fill with unvalidated candidates
      if (validQuestions.length < TARGET_COUNT) {
        console.warn(`Attempt ${attempts}: Validation filtered too many. Using fallback candidates.`);
        for (const q of candidates) {
          if (validQuestions.length < TARGET_COUNT) {
            const isDuplicate = validQuestions.some(vq => vq.question === q.question);
            if (!isDuplicate) {
              const shuffled = shuffleOptions(q);
              validQuestions.push(shuffled);
            }
          }
        }
      }
    }

    if (validQuestions.length === 0) {
      console.warn("Valid questions 0. Using FORCE fallback from candidates.");
      const candidates = await generateCandidates(apiKey, topic, difficulty, exclusionText, TARGET_COUNT, wikiData);
       if (candidates && candidates.length > 0) {
         validQuestions = candidates.map(q => shuffleOptions(q));
       }
    }

    // --- FINAL FALLBACK: If AI generation completely failed, generate simple quiz programmatically ---
    if (validQuestions.length === 0) {
        console.warn("AI Generation Failed. Using programmatic fallback.");
        
        // Extract first sentence for a natural quiz
        let summary = wikiData.content.split('。')[0];
        if (summary.length > 80) summary = summary.substring(0, 80) + "...";
        
        const fallbackQs = [
             {
                question: `「${wikiData.title}」に関する説明として正しいものはどれですか？`,
                options: [
                  summary + "。",
                  "この用語は、19世紀のフランス文学に由来する。",
                  "これは架空の概念であり、実在しない。",
                  "詳細な記録は一切残されていない。"
                ],
                correct_index: 0,
                explanation: `Wikipediaの概要には「${summary}」と記載されています。(出典: ${wikiData.url})`,
                citation: wikiData.url
            },
            {
                question: `「${wikiData.title}」について調べる際、最も信頼できる情報源の一つは何ですか？`,
                options: ["Wikipediaなどの百科事典", "個人の感想ブログ", "噂話", "何もしない"],
                correct_index: 0,
                explanation: `Wikipediaなどの百科事典は、基本的な情報を網羅的に知るのに役立ちます。(出典: ${wikiData.url})`,
                citation: wikiData.url
            },
            {
                question: `「${wikiData.title}」の内容が含まれている可能性が高いカテゴリは？`,
                options: ["一般教養・知識", "極秘ファイル", "未来予知", "個人の日記"],
                correct_index: 0,
                explanation: `「${wikiData.title}」は一般的な知識として分類されます。(出典: ${wikiData.url})`,
                citation: wikiData.url
            }
        ];
        validQuestions = fallbackQs.map(q => shuffleOptions(q));
    }

    if (validQuestions.length === 0) {
       // Should be unreachable
      return { status: "error", message: "Failed to generate valid questions after checks." };
    }

    return {
      status: "success",
      topic: topic,
      level: difficulty,
      questions: validQuestions
    };
  } catch (e) {
    console.error("generateQuiz Error:", e);
    return { status: "error", message: "Error: " + e.toString() };
  }
}

// --- Wikipedia Helpers (Async) ---

async function searchWikipedia(topic) {
  const url = "https://ja.wikipedia.org/w/api.php";
  const params = {
    action: "query",
    list: "search",
    srsearch: topic,
    format: "json",
    srlimit: 3 // Fetch slightly more
  };

  try {
    const response = await axios.get(url, {
      params,
      headers: { 'User-Agent': 'KnowlyQuizBot/1.0 (test@example.com)' }
    });
    const json = response.data;
    if (json.query && json.query.search && json.query.search.length > 0) {
      return json.query.search;
    }
    return [];
  } catch (e) {
    console.error("Wikipedia Search Error:", e.message);
    return [];
  }
}

async function getWikipediaContent(title) {
  const url = "https://ja.wikipedia.org/w/api.php";
  const params = {
    action: "query",
    prop: "extracts",
    titles: title,
    explaintext: 1,
    format: "json",
    redirects: 1
  };

  try {
    const response = await axios.get(url, {
      params,
      headers: { 'User-Agent': 'KnowlyQuizBot/1.0 (test@example.com)' }
    });
    const json = response.data;
    if (!json.query || !json.query.pages) return null;

    const pages = json.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId === "-1") return null;

    const page = pages[pageId];
    return {
      title: page.title,
      content: page.extract,
      url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`
    };
  } catch (e) {
    console.error("Wikipedia Content Error:", e.message);
    return null;
  }
}

// Helper to safely extract text from Gemini response
function getGeminiText(json) {
  if (json && json.candidates && json.candidates.length > 0 &&
    json.candidates[0].content &&
    json.candidates[0].content.parts &&
    json.candidates[0].content.parts.length > 0) {
    return json.candidates[0].content.parts[0].text;
  }
  return null;
}

function parseGeminiJSON(response) {
  try {
    // Check for HTTP error first
    if (response.getResponseCode && response.getResponseCode() !== 200) return null;
    
    // Get JSON object from response
    const json = response.getJson ? response.getJson() : response; 
    const text = getGeminiText(json);

    if (!text) {
        console.warn("parseGeminiJSON: No text in response");
        return null;
    }

    console.log("Raw Gemini Response:", text.substring(0, 200) + "..."); // Debug log

    // Robust JSON extraction using Regex to find the first { and last }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.warn("parseGeminiJSON: No JSON object found in text");
        return null;
    }
    
    const cleanText = jsonMatch[0];
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("parseGeminiJSON Error:", e);
    console.error("Failed text was:", text); // Log the full text on error
    return null;
  }
}

async function generateCandidates(apiKey, topic, difficulty, exclusionText, count, wikiData) {
  if (!wikiData || !wikiData.content) return [];

  console.log(`Generating quiz for topic: ${topic}`);
  console.log(`Source Article Title: ${wikiData.title}`);
  
  const truncatedContent = wikiData.content.substring(0, 15000);
  
  // Revised Prompt with explicit Topic context and Few-Shot example
  const singlePrompt = `
      You are a professional quiz creator.
      Target Audience: Japanese speakers.
      Topic: "${topic}"
      Difficulty: ${difficulty}/10

      Your task is to create a multiple-choice quiz question about "${topic}" based ONLY on the provided text.

      SOURCE TEXT (from Wikipedia "${wikiData.title}"):
      """
      ${truncatedContent} 
      """

      NEGATIVE CONSTRAINTS (STRICTLY FORBIDDEN):
      - DO NOT ask about "the text", "this article", "the author", or "Wikipedia".
      - DO NOT ask meta-questions like "What is the title of this passage?".
      - DO NOT use phrases like "According to the text", "Based on the article", "In this passage" in the question text. The question should stand alone as a general knowledge question.
      - DO NOT output any markdown formatting like \`\`\`json or \`\`\`. Output RAW JSON only.

      REQUIREMENTS:
      1. Question must be in Japanese.
      2. Question must test knowledge about "${topic}" (history, facts, people, definitions).
      3. Create 4 options: 1 Correct, 3 Distractors.
      4. Explanation must cite the specific fact from the text.
      
      OUTPUT FORMAT (JSON ONLY):
      {
        "question": "日本の首都はどこですか？",
        "options": [
          { "text": "東京", "is_correct": true },
          { "text": "大阪", "is_correct": false },
          { "text": "京都", "is_correct": false },
          { "text": "福岡", "is_correct": false }
        ],
        "explanation": "日本の首都は東京とされています。(出典: ${wikiData.url})",
        "citation": "${wikiData.url}"
      }
      
      ${exclusionText}
    `;

  const requests = [];
  for (let i = 0; i < count; i++) {
    requests.push({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: singlePrompt }] }],
        generationConfig: {
          temperature: 0.3 + (i * 0.1), // Slightly higher temp for variety
          response_mime_type: "application/json"
        }
      })
    });
  }

  try {
    const responses = await UrlFetchApp.fetchAll(requests);
    const candidates = [];

    for (const response of responses) {
      const q = parseGeminiJSON(response);

      if (!q) continue;

      try {
        q.citation = wikiData.url;

        // Clean up explanation
        let cleanExplanation = q.explanation || "";
        cleanExplanation = cleanExplanation.replace(/[\(（]\s*(Source|出典|Reference|ソース)[:：].*?[\)）]/gi, "");
        cleanExplanation = cleanExplanation.replace(/(Source|出典|Reference|ソース)[:：].*?$/mi, "");
        cleanExplanation = cleanExplanation.replace(/https?:\/\/[^\s\)]+/gi, "");
        cleanExplanation = cleanExplanation.replace(/\s{2,}/g, " ").trim();
        q.explanation = `${cleanExplanation} (出典: ${wikiData.url})`;

        // Validate structure
        if (q.question && Array.isArray(q.options) && q.options.length >= 2) {
             // Ensure at least one correct answer exists
             if(!q.options.some(o => o.is_correct)) {
                 q.options[0].is_correct = true; // Fallback fix
             }
             candidates.push(q);
        } else {
            console.warn("Invalid question structure:", JSON.stringify(q));
        }
      } catch (e) {
        console.error("Candidate Processing Error:", e);
      }
    }
    return candidates;
  } catch (e) {
    console.error("Candidate Gen Exception:", e);
    return [];
  }
}

function shuffleOptions(q) {
  let optionsNodes = [...q.options];
  for (let i = optionsNodes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [optionsNodes[i], optionsNodes[j]] = [optionsNodes[j], optionsNodes[i]];
  }

  const optionsText = optionsNodes.map(o => o.text);
  const correctIndex = optionsNodes.findIndex(o => o.is_correct);

  return {
    question: q.question,
    options: optionsText,
    correct_index: correctIndex !== -1 ? correctIndex : 0,
    explanation: q.explanation,
    citation: q.citation
  };
}


async function refineInterest(params) {
  try {
    const interest = params.interest;
    const historyJSON = params.history || "[]";
    const history = JSON.parse(historyJSON);
    let historyText = "";
    if (history.length > 0) {
      historyText = "Conversation History:\n" + history.map(h => `- ${h.role}: ${h.text}`).join("\n") + "\n";
    }

    let prompt = "";
    if (history.length === 0) {
      prompt = `
        You are a helpful assistant for "Knowly". A user has entered an interest: "${interest}".
        Your goal is to ask ONE clarification question to help them find a specific passion.
        RULES: Return 'broad'. Create a friendly Japanese clarification question.
        Question format: "いいですね！${interest}の中でも、特に何に興味がありますか？（例：[Specific Examples]）"
        Return JSON: { "status": "broad", "question": "string (Japanese question)", "refined_topic": null }
      `;
    } else {
      const lastUserMessage = history[history.length - 1].text;
      prompt = `
        You are a helpful assistant for "Knowly". User interest: "${interest}". Last reply: "${lastUserMessage}".
        Combine interest and reply into a final specific topic.
        Return JSON: { "status": "specific", "question": null, "refined_topic": "string (The final topic)" }
      `;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }
      }
    );

    const json = response.data;
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) return { status: "specific", refined_topic: interest };

    // Robust JSON Extraction
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    let jsonText = text;
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonText = text.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(jsonText);
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function submitAnswer(params) {
  // Mock logic
  return { correct: true, feedback: 'Correct!' };
}

function searchUsers(params) {
  try {
    const query = String(params.query || "").toLowerCase().trim();
    if (!query) return { status: "success", users: [] };

    const currentUserId = params.user_id;
    const followedIds = new Set(db.follows.filter(f => f.follower_id === currentUserId).map(f => f.following_id));

    const results = db.users
      .filter(u => u.user_id !== currentUserId && u.nickname.toLowerCase().includes(query))
      .map(u => ({
        user_id: u.user_id,
        nickname: u.nickname,
        avatar_url: u.avatar_url,
        is_following: followedIds.has(u.user_id)
      }));

    return { status: "success", users: results };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function toggleFollow(params) {
  try {
    const followerId = params.follower_id;
    const followingId = params.following_id;

    if (!followerId || !followingId) return { status: "error", message: "Missing IDs" };

    const existing = db.follows.find(f => f.follower_id === followerId && f.following_id === followingId);

    if (existing) {
      db.follows.delete(f => f.follower_id === followerId && f.following_id === followingId);
      return { status: "success", is_following: false };
    } else {
      db.follows.append({ follower_id: followerId, following_id: followingId, created_at: new Date().toISOString() });
      return { status: "success", is_following: true };
    }
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getFollowing(params) {
  try {
    const currentUserId = params.user_id;
    const followedIds = new Set(db.follows.filter(f => f.follower_id === currentUserId).map(f => f.following_id));

    const results = db.users
      .filter(u => followedIds.has(u.user_id))
      .map(u => ({
        user_id: u.user_id,
        nickname: u.nickname,
        avatar_url: u.avatar_url,
        is_following: true
      }));

    return { status: "success", users: results };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getExploreInterests(params) {
  try {
    const currentUserId = params.user_id;
    const followedIds = new Set(db.follows.filter(f => f.follower_id === currentUserId).map(f => f.following_id));

    if (followedIds.size === 0) return { status: "success", interests: [] };

    let allInterests = [];
    db.users.filter(u => followedIds.has(u.user_id)).forEach(u => {
      try {
        const interests = JSON.parse(u.interests);
        if (Array.isArray(interests)) allInterests = allInterests.concat(interests);
      } catch (e) { }
    });

    const uniqueInterests = [...new Set(allInterests)];
    const shuffled = uniqueInterests.sort(() => 0.5 - Math.random());
    return { status: "success", interests: shuffled.slice(0, 10) };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}


// --- API ROUTES ---

app.get('/api', async (req, res) => {
  const result = await handleRequest(req.query);
  res.json(result);
});

app.post('/api', async (req, res) => {
  // Merge body and query for convenience, similar to GAS e.parameter
  const params = { ...req.query, ...req.body };
  const result = await handleRequest(params);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`- API: http://localhost:${PORT}/api`);
  console.log(`- Uploads: http://localhost:${PORT}/uploads`);
});
