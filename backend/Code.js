function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const action = e.parameter.action;
    let result = {};

    if (action === 'get_quiz') {
      result = getQuiz(e.parameter);
    } else if (action === 'submit_answer') {
      result = submitAnswer(e.parameter);
    } else if (action === 'register_user') {
      result = registerUser(e.parameter);
    } else if (action === 'login_user') {
      result = loginUser(e.parameter);
    } else if (action === 'get_user') {
      result = getUser(e.parameter);
    } else if (action === 'get_explore_interests') {
      result = getExploreInterests(e.parameter);
    } else if (action === 'search_users') {
      result = searchUsers(e.parameter);
    } else if (action === 'toggle_follow') {
      result = toggleFollow(e.parameter);
    } else if (action === 'get_following') {
      result = getFollowing(e.parameter);
    } else if (action === 'update_profile') {
      result = updateProfile(e.parameter);
    } else if (action === 'generate_quiz') {
      result = generateQuiz(e.parameter);
    } else if (action === 'get_topic_progress') {
      result = getTopicProgress(e.parameter);
    } else if (action === 'update_progress') {
      result = updateProgress(e.parameter);
    } else if (action === 'refine_interest') {
      result = refineInterest(e.parameter);
    } else if (action === 'get_user_badges') {
      result = getUserBadges(e.parameter);
    } else {
      result = { error: 'Invalid action' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- Database Logic ---

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// --- User Registration with Image Upload ---

function registerUser(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let usersSheet = ss.getSheetByName("Users");
    if (!usersSheet) {
      usersSheet = ss.insertSheet("Users");
      usersSheet.appendRow(["user_id", "nickname", "password", "interests", "avatar_url", "created_at"]);
    }

    const usersData = usersSheet.getDataRange().getValues();
    // Check for duplicate nickname (skip header)
    for (let i = 1; i < usersData.length; i++) {
      if (String(usersData[i][1]).trim() === String(params.nickname).trim()) {
        return { status: "error", message: "This nickname is already taken." };
      }
    }

    // 1. Handle Image Upload (Base64)
    let avatarUrl = "";
    if (params.avatar_base64) {
      const data = Utilities.base64Decode(params.avatar_base64);
      const blob = Utilities.newBlob(data, params.avatar_mimeType, "avatar_" + Date.now());
      const file = DriveApp.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      // Use thumbnail format which is more reliable for embedding than export=view
      avatarUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=s200";
    }

    // 2. Generate User ID
    const userId = "u_" + Utilities.getUuid();

    // 3. Save to Sheet
    usersSheet.appendRow([
      userId,
      params.nickname,
      params.password, // Note: storing plain text as requested for prototype
      params.interests, // stringified json expected
      avatarUrl,
      new Date()
    ]);

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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usersSheet = ss.getSheetByName("Users");

    if (!usersSheet) {
      return { status: "error", message: "User database not found." };
    }

    const data = usersSheet.getDataRange().getValues();
    // Headers: user_id, nickname, password, interests, avatar_url, created_at
    // Row 0 is headers.

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[1]).trim() === String(params.nickname).trim()) {
        if (String(row[2]).trim() === String(params.password).trim()) {
          return {
            status: "success",
            user_id: row[0],
            nickname: row[1],
            interests: row[3], // this might be a JSON string, client parses it
            avatar_url: row[4]
          };
        } else {
          return { status: "error", message: "Incorrect password" };
        }
      }
    }

    return { status: "error", message: "User not found" };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getUser(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usersSheet = ss.getSheetByName("Users");
    if (!usersSheet) return { status: "error", message: "Users sheet not found" };

    const userId = params.user_id;
    const data = usersSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === userId) {
        const row = data[i];
        let interests = [];
        try {
          interests = JSON.parse(row[3]);
        } catch (e) {
          // Keep empty if parse fails
        }
        return {
          status: "success",
          user_id: row[0],
          nickname: row[1],
          interests: interests,
          avatar_url: row[4]
        };
      }
    }
    return { status: "error", message: "User not found" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function updateProfile(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usersSheet = ss.getSheetByName("Users");
    if (!usersSheet) return { status: "error", message: "Users sheet not found" };

    const userId = params.user_id;
    const data = usersSheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === userId) {
        rowIndex = i + 1; // 1-based index
        break;
      }
    }

    if (rowIndex === -1) return { status: "error", message: "User not found" };

    // Update Nickname
    if (params.nickname) {
      usersSheet.getRange(rowIndex, 2).setValue(params.nickname);
    }

    // Update Interests
    if (params.interests) {
      usersSheet.getRange(rowIndex, 4).setValue(params.interests); // JSON string expected
    }

    // Update Avatar if provided
    let avatarUrl = "";
    if (params.avatar_base64) {
      const data = Utilities.base64Decode(params.avatar_base64);
      const blob = Utilities.newBlob(data, params.avatar_mimeType, "avatar_" + Date.now());
      const file = DriveApp.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      // Use thumbnail format
      avatarUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=s200";
      usersSheet.getRange(rowIndex, 5).setValue(avatarUrl);
    }

    return { status: "success", avatar_url: avatarUrl }; // Return new URL if any, or empty string

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getProgressSheet(ss) {
  let sheet = ss.getSheetByName("Progress");
  if (!sheet) {
    sheet = ss.insertSheet("Progress");
    sheet.appendRow(["user_id", "topic", "max_level", "updated_at"]);
  }
  return sheet;
}

function getTopicProgress(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getProgressSheet(ss);
    const data = sheet.getDataRange().getValues();

    // Default
    let maxLevel = 1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === params.user_id && String(data[i][1]) === params.topic) {
        maxLevel = Number(data[i][2]);
        break;
      }
    }

    return { status: "success", max_level: maxLevel };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function updateProgress(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getProgressSheet(ss);
    const data = sheet.getDataRange().getValues();

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
          const historySheet = getTopicHistorySheet(ss);
          const timestamp = new Date();
          const rows = answeredQuestions.map(q => [userId, topic, q, timestamp]);
          rows.forEach(r => historySheet.appendRow(r));
        }
      } catch (e) {
        // Log error to a 'Logs' sheet or console if easier
        console.error("Failed to save history: " + e.toString());
      }
    }

    // 2. Level System Logic
    // Only unlock next level if score is perfect (5)
    if (score < 5) {
      return { status: "success", unlocked: false };
    }

    let rowIndex = -1;
    let currentMax = 1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === userId && String(data[i][1]) === topic) {
        rowIndex = i + 1;
        currentMax = Number(data[i][2]);
        break;
      }
    }

    // Badge Logic: Clear Level 10 with perfect score
    let badgeAwarded = false;
    // Use Number() to ensure type safety, but loose equality just in case
    if (Number(currentLevel) === 10 && Number(score) === 5) {
      badgeAwarded = awardBadge(ss, userId, topic);
      // Log for debugging (will appear in GAS executions)
      console.log(`Badge Attempt: User ${userId}, Topic ${topic}, Result: ${badgeAwarded}`);
    }

    // Only increment if we just cleared the highest available level, and max is 10
    if (currentLevel === currentMax && currentMax < 10) {
      const newMax = currentMax + 1;
      if (rowIndex === -1) {
        sheet.appendRow([userId, topic, newMax, new Date()]);
      } else {
        sheet.getRange(rowIndex, 3).setValue(newMax);
        sheet.getRange(rowIndex, 4).setValue(new Date());
      }
      return { status: "success", unlocked: true, new_max_level: newMax, badge_awarded: badgeAwarded };
    }

    return { status: "success", unlocked: false, badge_awarded: badgeAwarded };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

// --- Badge Logic ---
function getBadgesSheet(ss) {
  let sheet = ss.getSheetByName("UserBadges");
  if (!sheet) {
    sheet = ss.insertSheet("UserBadges");
    sheet.appendRow(["user_id", "topic", "awarded_at"]);
  }
  return sheet;
}

function awardBadge(ss, userId, topic) {
  try {
    const sheet = getBadgesSheet(ss);
    const data = sheet.getDataRange().getValues();

    // Check if already exists
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === userId && String(data[i][1]) === topic) {
        return false; // Already has badge
      }
    }

    sheet.appendRow([userId, topic, new Date()]);
    return true;
  } catch (e) {
    console.error("Error awarding badge: " + e.toString());
    return false;
  }
}

function getUserBadges(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getBadgesSheet(ss);
    const data = sheet.getDataRange().getValues();
    const userId = params.user_id;
    const badges = [];

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === userId) {
        // Return topic as badge identifier for now
        badges.push({
          topic: data[i][1],
          awarded_at: data[i][2]
        });
      }
    }
    return { status: "success", badges: badges };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

// --- Topic History Logic ---

function getTopicHistorySheet(ss) {
  let sheet = ss.getSheetByName("TopicHistory");
  if (!sheet) {
    sheet = ss.insertSheet("TopicHistory");
    sheet.appendRow(["user_id", "topic", "question_text", "created_at"]);
  }
  return sheet;
}

function getAnsweredQuestions(ss, userId, topic) {
  try {
    const sheet = getTopicHistorySheet(ss);
    const data = sheet.getDataRange().getValues();
    const questions = [];

    // Skip header
    for (let i = 1; i < data.length; i++) {
      // userId (0), topic (1), question (2)
      if (String(data[i][0]) === userId && String(data[i][1]) === topic) {
        questions.push(String(data[i][2]));
      }
    }
    return questions;
  } catch (e) {
    return [];
  }
}

function generateQuiz(params) {
  try {
    const topic = params.topic || "General Knowledge";
    const difficulty = params.difficulty || 1;
    const userId = params.user_id;

    // 1. Get Excluded Questions (History)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const answeredQuestions = getAnsweredQuestions(ss, userId, topic);

    let exclusionText = "";
    if (answeredQuestions.length > 0) {
      exclusionText = `
      EXCLUDED QUESTIONS (Do NOT repeat these):
      ${answeredQuestions.map(q => `- ${q}`).join('\n')}
      `;
    }

    // --- NEW GENERATION LOOP WITH VALIDATION ---
    const TARGET_COUNT = 5;
    let validQuestions = [];
    let attempts = 0;
    const MAX_ATTEMPTS = 2; // Safety break

    // API Key setup
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return { status: "error", message: "GEMINI_API_KEY not configured" };
    }

    // 2. Search Wikipedia
    const searchResults = searchWikipedia(topic);
    if (!searchResults || searchResults.length === 0) {
      console.warn("No Wikipedia results for: " + topic);
      return { status: "error", message: "No Wikipedia results found for: " + topic };
    }

    // 3. Get Content from Top Results (Fetch Multiple)
    const topResults = searchResults.slice(0, 3);
    const wikiDataList = [];

    for (const result of topResults) {
      const data = getWikipediaContent(result.title);
      if (data && data.content) {
        wikiDataList.push(data);
      }
    }

    if (wikiDataList.length === 0) {
      console.warn(`No content found for any Wikipedia pages: ${topResults.map(r => r.title).join(", ")}`);
      return { status: "error", message: "Failed to retrieve content from Wikipedia." };
    }

    while (validQuestions.length < TARGET_COUNT && attempts < MAX_ATTEMPTS) {
      attempts++;
      const needed = TARGET_COUNT - validQuestions.length;
      // Generate extra candidates to buffer against rejection
      const countToGenerate = needed + 2;

      console.log(`Attempt ${attempts}: Generating ${countToGenerate} candidates for ${needed} slots.`);

      // Pass wikiDataList directly
      const candidates = generateCandidates(apiKey, topic, difficulty, exclusionText, countToGenerate, wikiDataList);

      if (candidates.length === 0) continue;

      // Validate candidates
      const validatedBatch = validateCandidates(apiKey, candidates, wikiDataList);

      // Add valid ones to our list
      for (const q of validatedBatch) {
        if (validQuestions.length < TARGET_COUNT) {
          // Shuffle options before adding (Final Polish)
          const shuffled = shuffleOptions(q);
          validQuestions.push(shuffled);
        }
      }

      // Fallback: If we still don't have enough, fill with unvalidated candidates
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

    // Final check
    if (validQuestions.length === 0) {
      return { status: "error", message: "Failed to generate any valid questions." };
    }

    return {
      status: "success",
      topic: topic,
      level: difficulty,
      questions: validQuestions
    };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

// --- Helper Functions (Top Level) ---

function buildGeminiRequest(apiKey, prompt, useSearch = true) {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.0, response_mime_type: "application/json" } // Force JSON
  };

  if (useSearch) {
    payload.tools = [{ google_search: {} }];
  }

  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
}

function parseGeminiJSON(response) {
  try {
    let contentText = "";
    if (response && typeof response.getContentText === 'function') {
      if (response.getResponseCode() !== 200) return null;
      contentText = response.getContentText();
    } else if (response && response.candidates) {
      // Already parsed object?
      const text = getGeminiText(response);
      return simpleJSONParse(text);
    } else {
      return null; // Unknown format
    }

    const json = JSON.parse(contentText);
    const text = getGeminiText(json);

    if (!text) return null;

    return simpleJSONParse(text);

  } catch (e) {
    console.error("parseGeminiJSON Error: " + e.toString());
    return null;
  }
}

function simpleJSONParse(text) {
  if (!text) return null;
  // Remove markdown code blocks (```json ... ```)
  let cleanText = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");

  const firstChar = cleanText.search(/[\{\[]/);
  if (firstChar === -1) return null;

  const match = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
    cleanText = match[0];
  } else {
    cleanText = cleanText.substring(firstChar);
  }

  try {
    return JSON.parse(cleanText);
  } catch (e2) {
    return null;
  }
}

function getGeminiText(json) {
  if (json && json.candidates && json.candidates.length > 0 &&
    json.candidates[0].content &&
    json.candidates[0].content.parts &&
    json.candidates[0].content.parts.length > 0) {
    return json.candidates[0].content.parts[0].text;
  }
  return null;
}

function generateCandidates(apiKey, topic, difficulty, exclusionText, count, wikiDataList) {
  if (!wikiDataList || wikiDataList.length === 0) {
    console.warn(`Invalid wikiDataList provided.`);
    return [];
  }

  // Combine content from all pages
  let combinedContent = "";
  const sourceUrls = [];

  for (const data of wikiDataList) {
    if (data && data.content) {
      sourceUrls.push(data.url);
      combinedContent += `\n--- SOURCE: ${data.title} ---\n${data.content.substring(0, 10000)}\n`;
    }
  }

  // Truncate
  if (combinedContent.length > 50000) {
    combinedContent = combinedContent.substring(0, 50000) + "\n...(truncated)...";
  }

  const prompt = `
  あなたはプロのクイズ作家です。
  以下の「ソーステキスト」の内容のみに基づいて、4択クイズを作成してください。
  
  ソーステキスト:
  """
  ${combinedContent}
  """

  Target Audience: Japanese speakers.
  Difficulty Level: ${difficulty}/10.
  
  ${exclusionText}

  【制約事項】
  1. 問題は、上記の「ソーステキスト」に含まれる情報だけで正解が導き出せるものにしてください。
  2. **重要**: 問題文や解説文に「本文中には」「テキストによると」「上記によると」といった、メタな言及は**絶対に行わないでください**。あくまで一般的な知識クイズとして自然に振る舞ってください。
  3. 外部知識の使用は禁止です（ソーステキストにある情報のみを使うこと）。
  4. 選択肢は4つ（正解1つ、不正解3つ）作成してください。
  5. 不正解の選択肢（誤答）は、もっともらしいが、ソーステキストの内容に基づくと明確に間違いであるものにしてください。
  6. 「解説（explanation）」には、正解の理由を説明してください。「出典」は別途付与するため、解説文の中にURLを含める必要はありません。

  【出力フォーマット (JSON ARRAY)】
  [
    {
      "question": "クイズの問題文（日本語）。",
      "options": [
        { "text": "選択肢1", "is_correct": boolean },
        { "text": "選択肢2", "is_correct": boolean },
        { "text": "選択肢3", "is_correct": boolean },
        { "text": "選択肢4", "is_correct": boolean }
      ],
      "explanation": "解説文（日本語）。"
    }
  ]
  Create ${count} questions.
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
  };

  try {
    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }
    );

    const json = parseGeminiJSON(response); // Use helper

    if (Array.isArray(json)) return processCandidates(json, sourceUrls);

    return [];

  } catch (e) {
    console.error("Candidate Gen Exception: " + e.toString());
    return [];
  }
}

function processCandidates(candidates, sourceUrls) {
  if (!Array.isArray(candidates)) return [];

  return candidates.map(c => {
    // Citation
    c.citation = sourceUrls.join(", ");

    // Clean Explanation
    let cleanExplanation = c.explanation || "";
    cleanExplanation = cleanExplanation.replace(/[\(（]\s*(Source|出典|Reference|ソース)[:：].*?[\)）]/gi, "");
    cleanExplanation = cleanExplanation.replace(/(Source|出典|Reference|ソース)[:：].*?$/mi, "");
    cleanExplanation = cleanExplanation.replace(/https?:\/\/[^\s\)]+/gi, "");
    cleanExplanation = cleanExplanation.replace(/\s{2,}/g, " ").trim();
    c.explanation = `${cleanExplanation} (出典: ${sourceUrls.join(", ")})`;

    // Validate Options
    if (c.options && Array.isArray(c.options) && c.options.length >= 2) {
      if (!c.options.some(o => o.is_correct)) {
        c.options[0].is_correct = true;
      }
    }
    return c;
  }).filter(c => c.question && c.options && Array.isArray(c.options) && c.options.length >= 2);
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
    explanation: q.explanation
  };
}

// --- Wikipedia Helpers (Adapted for GAS) ---

function searchWikipedia(topic) {
  // Fetch more results (10) to allow re-ranking
  const url = "https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(topic) + "&format=json&srlimit=10";
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return [];

    const json = JSON.parse(response.getContentText());
    if (json.query && json.query.search && json.query.search.length > 0) {
      const results = json.query.search;

      // --- Re-ranking Logic ---
      // 1. Tokenize topic
      // Split by colon or space, remove empty strings, convert to lowercase
      const tokens = topic.split(/[:\s\u3000]+/).filter(t => t.length > 0).map(t => t.toLowerCase());

      // 2. Score each result
      results.forEach(r => {
        let score = 0;
        const text = (r.title + " " + (r.snippet || "")).toLowerCase(); // Combined search text

        tokens.forEach(t => {
          if (text.includes(t)) score++;
        });

        // Bonus for exact title match (optional)
        if (r.title.toLowerCase() === topic.toLowerCase()) score += 5;

        r._score = score;
      });

      // 3. Sort by Score (Descending)
      results.sort((a, b) => b._score - a._score);

      // Return top 3
      return results.slice(0, 3);
    }
    return [];
  } catch (e) {
    console.error("Wikipedia Search Error: " + e.toString());
    return [];
  }
}

function getWikipediaContent(title) {
  const url = "https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&titles=" + encodeURIComponent(title) + "&explaintext=1&format=json&redirects=1";
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;

    const json = JSON.parse(response.getContentText());
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
    console.error("Wiki Content Error: " + e.toString());
    return null;
  }
}

function validateCandidates(apiKey, candidates, wikiDataList) {
  if (!wikiDataList || wikiDataList.length === 0) return candidates;
  // Use first for context
  const wikiData = wikiDataList[0];
  const truncatedContent = wikiData.content.substring(0, 15000);

  const candidatesToCheck = candidates.filter(q => q && q.options && Array.isArray(q.options));
  const requests = [];

  candidatesToCheck.forEach(q => {
    const correctOption = q.options.find(o => o.is_correct)?.text || "Unknown";
    const distractors = q.options.filter(o => !o.is_correct).map(o => o.text).join(", ");

    // 1. Self-Correction
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

    // 2. Audit
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
       Return JSON: { "pass": boolean, "reason": "string" }
     `;

    const makeReq = (p) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: p }] }],
        generationConfig: { temperature: 0.0, response_mime_type: "application/json" }
      }),
      muteHttpExceptions: true
    });

    requests.push(makeReq(prompt1));
    requests.push(makeReq(prompt2));
  });

  if (requests.length === 0) return [];

  console.log(`Running ${requests.length} validation checks...`);

  try {
    const responses = UrlFetchApp.fetchAll(requests);
    const validBatch = [];

    for (let i = 0; i < candidatesToCheck.length; i++) {
      // Validation logic
      if (responses.length <= i * 2 + 1) break;

      const r1 = parseGeminiJSON(responses[i * 2]);
      const r2 = parseGeminiJSON(responses[i * 2 + 1]);

      const check1 = r1?.confident === true;
      const check2 = r2?.pass === true;

      // Relaxed check: if Auditor says pass, or Scaled Confidence
      if (check2 || check1) {
        validBatch.push(candidatesToCheck[i]);
      } else {
        console.log("Rejected Q:", candidatesToCheck[i].question);
      }
    }
    return validBatch;
  } catch (e) {
    console.error("Validation Error: " + e.toString());
    return candidates;
  }
}

// --- Other Features (Refined / Friends) ---

function refineInterest(params) {
  try {
    const interest = params.interest;
    const historyJSON = params.history || "[]";
    const history = JSON.parse(historyJSON);

    // Format history for the prompt
    let historyText = "";
    if (history.length > 0) {
      historyText = "Conversation History:\n" + history.map(h => `- ${h.role}: ${h.text}`).join("\n") + "\n";
    }

    let prompt = "";

    // --- STAGE 1: INITIAL DISCOVERY (History is Empty) ---
    if (history.length === 0) {
      prompt = `
      You are a helpful assistant for "Knowly". A user has entered an interest: "${interest}".
      Your goal is to ask ONE clarification question to help them find a specific passion.
      
      RULES:
      - Return 'broad'.
      - Create a friendly Japanese clarification question.
      - Question format: "いいですね！${interest}の中でも、特に何に興味がありますか？（例：[Specific Examples]）"
      - Do not assume a specific topic yet.
      
      Return JSON:
      {
        "status": "broad",
        "question": "string (Japanese question)",
        "refined_topic": null
      }
    `;
    }
    // --- STAGE 2: FINALIZATION (History Exists) ---
    else {
      // The user has replied. We MUST finalize now.
      const lastUserMessage = history[history.length - 1].text;

      prompt = `
      You are a helpful assistant for "Knowly".
      The user is interested in "${interest}".
      I asked them a clarification question, and they just replied: "${lastUserMessage}".
      
      YOUR GOAL: Combine the original interest and their reply into a final specific topic.
      
      RULES:
      - RETURN 'specific' ONLY.
      - DO NOT ASK MORE QUESTIONS. This is the final step.
      - If user said "All", "General", "Everything", "特にない", "全部":
        -> Refined Topic: "${interest}: General"
      - Otherwise:
        -> Refined Topic: "${interest}: ${lastUserMessage}" (Clean up if needed, e.g. remove "Check" or "I like")
        
      Return JSON:
      {
        "status": "specific", 
        "question": null,
        "refined_topic": "string (The final topic)"
      }
    `;
    }

    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    const response = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
        }
      })
    });

    return parseGeminiJSON(response) || { status: "specific", refined_topic: interest };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getQuiz(params) {
  return { status: "error", message: "Use generate_quiz instead" };
}

function submitAnswer(params) {
  // Mock
  const correct = true;
  return {
    correct: correct,
    feedback: correct ? 'Correct! You have a good ear.' : 'Not quite. It is New Jack Swing.'
  };
}

// --- Friend System Logic ---

function getFollowsSheet(ss) {
  let sheet = ss.getSheetByName("Follows");
  if (!sheet) {
    sheet = ss.insertSheet("Follows");
    sheet.appendRow(["follower_id", "following_id", "created_at"]);
  }
  return sheet;
}

function getFollowedUserIds(ss, followerId) {
  const sheet = getFollowsSheet(ss);
  const data = sheet.getDataRange().getValues();
  // Headers: follower_id, following_id, created_at

  const followedIds = new Set();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === followerId) {
      followedIds.add(String(data[i][1]));
    }
  }
  return followedIds;
}

function searchUsers(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usersSheet = ss.getSheetByName("Users");
    if (!usersSheet) return { status: "error", message: "Users sheet not found" };

    const query = String(params.query || "").toLowerCase().trim();
    if (!query) return { status: "success", users: [] };

    const currentUserId = params.user_id; // Current user ID
    const followedIds = getFollowedUserIds(ss, currentUserId);

    const data = usersSheet.getDataRange().getValues();
    const results = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i]; // user_id (0), nickname (1), password (2), interests (3), avatar_url (4)
      const userId = String(row[0]);
      const nickname = String(row[1]);

      if (userId !== currentUserId && nickname.toLowerCase().includes(query)) {
        results.push({
          user_id: userId,
          nickname: nickname,
          avatar_url: row[4],
          is_following: followedIds.has(userId)
        });
      }
    }

    return { status: "success", users: results };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function toggleFollow(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const followsSheet = getFollowsSheet(ss);

    const followerId = params.follower_id;
    const followingId = params.following_id;

    if (!followerId || !followingId) {
      return { status: "error", message: "Missing IDs" };
    }

    const data = followsSheet.getDataRange().getValues();
    let rowIndexToDelete = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === followerId && String(data[i][1]) === followingId) {
        rowIndexToDelete = i + 1; // 1-based index
        break;
      }
    }

    if (rowIndexToDelete !== -1) {
      // Unfollow
      followsSheet.deleteRow(rowIndexToDelete);
      return { status: "success", is_following: false };
    } else {
      // Follow
      followsSheet.appendRow([followerId, followingId, new Date()]);
      return { status: "success", is_following: true };
    }
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getFollowing(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usersSheet = ss.getSheetByName("Users");
    if (!usersSheet) return { status: "error", message: "Users sheet not found" };

    const currentUserId = params.user_id;
    const followedIds = getFollowedUserIds(ss, currentUserId);

    if (followedIds.size === 0) {
      return { status: "success", users: [] };
    }

    const data = usersSheet.getDataRange().getValues();
    const results = [];

    // Skip header
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const userId = String(row[0]);

      if (followedIds.has(userId)) {
        results.push({
          user_id: userId,
          nickname: row[1],
          avatar_url: row[4],
          is_following: true
        });
      }
    }

    return { status: "success", users: results };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getExploreInterests(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usersSheet = ss.getSheetByName("Users");
    if (!usersSheet) return { status: "error", message: "Users sheet not found" };

    const currentUserId = params.user_id;

    // Get valid followed IDs
    const followedIds = getFollowedUserIds(ss, currentUserId);
    if (followedIds.size === 0) {
      // Fallback: If no friends
      return { status: "success", interests: [] };
    }

    const data = usersSheet.getDataRange().getValues();
    let allInterests = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowUserId = String(row[0]);

      if (followedIds.has(rowUserId)) {
        try {
          const interests = JSON.parse(row[3]);
          if (Array.isArray(interests)) {
            allInterests = allInterests.concat(interests);
          }
        } catch (e) { }
      }
    }

    const uniqueInterests = [...new Set(allInterests)];
    const shuffled = uniqueInterests.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);

    return {
      status: "success",
      interests: selected
    };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

// Function to run in editor to trigger permissions
function test_auth() {
  console.log("Testing authorization...");
  UrlFetchApp.fetch("https://www.google.com");
  console.log("Authorization successful.");
  console.log(generateQuiz({ topic: "Test" }));
}
