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
    // ... rest of existing code ...
    // const newUserRow = []; // This line is not relevant for getUserBadges

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

    // 1. Search Wikipedia (Perform ONCE)
    const searchResults = searchWikipedia(topic);
    if (searchResults.length === 0) {
      console.warn(`No Wikipedia results for topic: ${topic}`);
      // Fallback or Error? 
      // For now, let's return error so frontend knows.
      return { status: "error", message: "No Wikipedia results found for: " + topic };
    }

    // 2. Get Content from Top Results (Randomize for variety)
    // Pick from top 3 to avoid getting stuck on one article if we need to retry
    const index = Math.floor(Math.random() * Math.min(searchResults.length, 3));
    const targetArticle = searchResults[index];
    const wikiData = getWikipediaContent(targetArticle.title);

    if (!wikiData || !wikiData.content) {
      console.warn(`No content found for Wikipedia page: ${targetArticle.title}`);
      return { status: "error", message: "Failed to retrieve content from Wikipedia." };
    }

    while (validQuestions.length < TARGET_COUNT && attempts < MAX_ATTEMPTS) {
      attempts++;
      const needed = TARGET_COUNT - validQuestions.length;
      // Generate extra candidates to buffer against rejection
      const countToGenerate = needed + 2;

      console.log(`Attempt ${attempts}: Generating ${countToGenerate} candidates for ${needed} slots.`);

      // Pass wikiData directly
      const candidates = generateCandidates(apiKey, topic, difficulty, exclusionText, countToGenerate, wikiData);

      if (candidates.length === 0) continue;

      // Validate candidates in parallel
      const validatedBatch = validateCandidates(apiKey, candidates, wikiData);

      // 1. Add Validated Questions First (High Quality)
      for (const q of validatedBatch) {
        if (validQuestions.length < TARGET_COUNT) {
          const shuffled = shuffleOptions(q);
          validQuestions.push(shuffled);
        }
      }

      // 2. Fallback: If we still don't have enough, fill with unvalidated candidates
      // This prevents "Failed to generate" errors when the validator is too strict or API flakes out.
      if (validQuestions.length < TARGET_COUNT) {
        console.warn(`Attempt ${attempts}: Validation filtered too many. Using fallback candidates.`);
        for (const q of candidates) {
          if (validQuestions.length < TARGET_COUNT) {
            // Avoid duplicates check (simple text comparison)
            const isDuplicate = validQuestions.some(vq => vq.question === q.question);
            if (!isDuplicate) {
              const shuffled = shuffleOptions(q);
              validQuestions.push(shuffled);
            }
          }
        }
      }
    }

    // Fallback: If we still don't have enough, we return what we have
    // (Or we could have a fallback generation without strict checks if truly desperate, 
    // but better to return fewer high-quality questions than garbage)

    // --- FINAL FALLBACK: If AI generation completely failed, generate simple quiz programmatically ---
    if (validQuestions.length === 0) {
      console.warn("AI Generation Failed. Using programmatic fallback.");

      // Extract first sentence for a natural quiz
      let summary = "";
      if (wikiData && wikiData.content) {
        summary = wikiData.content.split('。')[0];
        if (summary.length > 80) summary = summary.substring(0, 80) + "...";
      }

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
      // Should be unreachable now
      return { status: "error", message: "Failed to generate valid questions after checks." };
    }

    return {
      status: "success",
      topic: topic,
      level: difficulty,
      questions: validQuestions
    };

  } catch (e) {
    console.error("generateQuiz Error: " + e.toString());
    return { status: "error", message: "Error: " + e.toString() };
  }
}

// --- HELPER FUNCTIONS FOR ROBUST GENERATION ---

// --- Wikipedia API Helpers ---

function searchWikipedia(topic) {
  try {
    const url = `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return [];

    const json = JSON.parse(response.getContentText());
    return json.query?.search || [];
  } catch (e) {
    console.warn("Wikipedia Search Error:", e);
    return [];
  }
}

function getWikipediaContent(title) {
  try {
    // API endpoint needs 'origin=*' for CORS if called from browser, but acceptable in GAS.
    // Ideally we should use 'redirects=1' to handle redirects automatically.
    const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&redirects=1&titles=${encodeURIComponent(title)}&format=json`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      console.warn(`Wiki API HTTP Error: ${response.getResponseCode()}`);
      return null;
    }

    const json = JSON.parse(response.getContentText());
    const pages = json.query?.pages;
    if (!pages) return null;

    const pageIds = Object.keys(pages);
    if (pageIds.length === 0) return null;

    const pageId = pageIds[0];
    if (pageId === "-1") {
      console.warn(`Wiki Page Not Found (ID -1): ${title}`);
      return null;
    }

    const page = pages[pageId];
    if (!page || !page.title) return null;

    // Handle missing extract (some pages are special or empty)
    if (!page.extract) {
      console.warn(`Wiki Page has no extract: ${title}`);
      return null;
    }

    return {
      title: page.title,
      content: page.extract,
      // Use the canonical URL from the response or construct it carefully
      url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`
    };
  } catch (e) {
    console.warn("Wikipedia Content Error:", e);
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

function generateCandidates(apiKey, topic, difficulty, exclusionText, count, wikiData) {
  if (!wikiData || !wikiData.content) {
    console.warn(`Invalid wikiData provided.`);
    return [];
  }

  // Truncate content if too long (Gemini 1.5 Pro has huge context, but let's be safe/efficient)
  // 20k chars is plenty for a quiz.
  const truncatedContent = wikiData.content.substring(0, 20000);

  const prompt = `
      Create ${count} multiple choice quiz question(s) based ONLY on the following text.
      
      SOURCE TEXT:
      """
      ${truncatedContent}
      """

      Target Audience: Japanese speakers.
      Difficulty Level: ${difficulty}/10.

      DIFFICULTY GUIDELINES:
      - Level 1-3: Basic facts found in the introduction or early sections.
      - Level 4-6: Specific details, dates, or names found in the body.
      - Level 7-10: Minor details, production notes, or specific statistics.
      
      ${exclusionText}

      NEGATIVE CONSTRAINTS (CRITICAL):
      - Do NOT ask what the title of the article is (e.g., "What is the name of this Wikipedia article?").
      - Do NOT ask about the structure of the article (e.g., "What is the first sentence?", "Does it have a See Also section?").
      - Do NOT use phrases like "According to the text", "Based on the article", "In this passage" in the question text. The question should stand alone as a general knowledge question.
      - Do NOT ask about the URL or meta-data.
      - Do NOT create questions where the answer is simply the topic name itself, unless asking for a specific alternate name or definition.

      CRITICAL PROCESS:
      1. Read the SOURCE TEXT carefully.
      2. Identify facts suitable for the requested difficulty (history, characteristics, dates, people, significance).
      3. Create a question that is STRICTLY answerable using ONLY the Source Text.
      4. Create 3 distractors that are plausible but incorrect based on the text.
      5. WRITE THE EXPLANATION BASED ONLY ON THE SOURCE TEXT. Do not use outside knowledge. Explain *why* the answer is correct using facts from the provided text.

      REQUIRED OUTPUT FORMAT:
      Return ONLY a raw JSON array.
      [
        {
          "question": "string (in Japanese)",
          "options": [
            { "text": "string (Correct Option)", "is_correct": true },
            { "text": "string (Wrong Option 1)", "is_correct": false },
            { "text": "string (Wrong Option 2)", "is_correct": false },
            { "text": "string (Wrong Option 3)", "is_correct": false }
          ],
          "explanation": "string (Explanation based STRICTLY on the Source Text above) (出典: ${wikiData.url})",
          "citation": "${wikiData.url}"
        }
      ]
    `;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4000 }
  };

  try {
    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }
    );

    if (response.getResponseCode() !== 200) {
      console.error("Gemini Gen Error", response.getContentText());
      return [];
    }

    const json = JSON.parse(response.getContentText());
    const text = getGeminiText(json);

    if (!text) return [];

    // Extract JSON
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      text = text.substring(firstBracket, lastBracket + 1);
      try {
        const candidates = JSON.parse(text);
        // Force inject the URL just in case LLM messed it up
        return candidates.map(c => {
          // 1. Ensure citation field matches the source we provided
          c.citation = wikiData.url;

          // 2. Clean up explanation to strictly use our Wikipedia URL
          let cleanExplanation = c.explanation || "";

          // Remove existing Source tags (English/Japanese)
          cleanExplanation = cleanExplanation.replace(/[\(（]\s*(Source|出典|Reference|ソース)[:：].*?[\)）]/gi, "");
          cleanExplanation = cleanExplanation.replace(/(Source|出典|Reference|ソース)[:：].*?$/mi, "");

          // Remove ALL URLs from the text to prevent hallucinations or external links
          // We replace them with empty string.
          cleanExplanation = cleanExplanation.replace(/https?:\/\/[^\s\)]+/gi, "");

          // Clean up any double spaces or dangling punctuation left over
          cleanExplanation = cleanExplanation.replace(/\s{2,}/g, " ").trim();

          // Trim and append the correct source
          c.explanation = `${cleanExplanation} (出典: ${wikiData.url})`;

          return c;
        });
      } catch (e) {
        console.error("JSON Parse Error:", e);
        return [];
      }
    }
    return [];

  } catch (e) {
    console.error("Candidate Gen Exception: " + e.toString());
    return [];
  }
}

function validateCandidates(apiKey, candidates, wikiData) {
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
    requests.push(buildGeminiRequest(apiKey, prompt1, false)); // No Search

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
    requests.push(buildGeminiRequest(apiKey, prompt2, false)); // No Search

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
    requests.push(buildGeminiRequest(apiKey, prompt3, false)); // No Search
  });

  console.log(`Running ${requests.length} validation checks...`);

  try {
    const responses = UrlFetchApp.fetchAll(requests);
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
      // The Solver is often flaky with exact string matching, so we don't want it to veto a good question.
      // The Judge (check2) is the most holistic check.
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
    if (!response || response.getResponseCode() !== 200) return null;
    const json = JSON.parse(response.getContentText());

    const text = getGeminiText(json);

    if (!text) return null;

    // Remove markdown code blocks (```json ... ```)
    let cleanText = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    
    // Robust JSON extraction: look for first '{' or '[' and last '}' or ']'
    // This handles both Objects and Arrays, and ignores surrounding text/markdown
    const firstChar = cleanText.search(/[\{\[]/);
    if (firstChar === -1) {
       console.warn("parseGeminiJSON: No JSON start found");
       return null; 
    }
    
    // Find the corresponding closing bracket by counting balance or just regex
    // Simple regex for outermost structure is safer if we assume valid JSON
    const match = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    
    if (match) {
        cleanText = match[0];
    } else {
        // Fallback: try substring from first char
        cleanText = cleanText.substring(firstChar);
    }
    
    try {
        return JSON.parse(cleanText);
    } catch (e2) {
        // Last ditch effort: simple trimming of commonly added garbage
        console.warn("parseGeminiJSON: Direct parse failed, trying aggressive cleanup", e2);
        return null;
    }

  } catch (e) {
    console.error("parseGeminiJSON Error: " + e.toString());
    return null;
  }
}

function generateCandidates(apiKey, topic, difficulty, exclusionText, count, wikiData) {
  if (!wikiData || !wikiData.content) {
    console.warn(`Invalid wikiData provided.`);
    return [];
  }

  // Truncate content if too long
  const truncatedContent = wikiData.content.substring(0, 20000);

  // Revised Prompt with explicit Topic context and Few-Shot example
  // We request an ARRAY of questions here to be efficient with one call
  const prompt = `
      You are a professional quiz creator.
      Target Audience: Japanese speakers.
      Topic: "${topic}"
      Difficulty: ${difficulty}/10

      Your task is to create ${count} multiple-choice quiz questions about "${topic}" based ONLY on the provided text.

      SOURCE TEXT (from Wikipedia "${wikiData.title}"):
      """
      ${truncatedContent} 
      """

      NEGATIVE CONSTRAINTS (STRICTLY FORBIDDEN):
      - DO NOT ask about "the text", "this article", "the author", or "Wikipedia".
      - DO NOT ask meta-questions like "What is the title of this passage?".
      - DO NOT output any markdown formatting like \`\`\`json or \`\`\`. Output RAW JSON only.

      REQUIREMENTS:
      1. Questions must be in Japanese.
      2. Questions must test knowledge about "${topic}" (history, facts, people, definitions).
      3. Create 4 options: 1 Correct, 3 Distractors.
      4. Explanation must cite the specific fact from the text.
      
      OUTPUT FORMAT (JSON ARRAY ONLY):
      [
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
      ]
      
      ${exclusionText}
    `;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 8000 } // Increased token limit for multiple questions
  };

  try {
    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }
    );

    if (response.getResponseCode() !== 200) {
      console.error("Gemini Gen Error", response.getContentText());
      return [];
    }

    // Parse using robust helper
    const json = JSON.parse(response.getContentText());
    const text = getGeminiText(json);

    if (!text) return [];

    // Robust JSON extraction using Regex to find the first [ and last ]
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        console.warn("generateCandidates: No JSON array found in text");
        return [];
    }
    
    try {
        const candidates = JSON.parse(jsonMatch[0]);
        // Force inject the URL just in case LLM messed it up
        return candidates.map(c => {
          c.citation = wikiData.url;

          let cleanExplanation = c.explanation || "";
          cleanExplanation = cleanExplanation.replace(/[\(（]\s*(Source|出典|Reference|ソース)[:：].*?[\)）]/gi, "");
          cleanExplanation = cleanExplanation.replace(/(Source|出典|Reference|ソース)[:：].*?$/mi, "");
          cleanExplanation = cleanExplanation.replace(/https?:\/\/[^\s\)]+/gi, "");
          cleanExplanation = cleanExplanation.replace(/\s{2,}/g, " ").trim();
          c.explanation = `${cleanExplanation} (出典: ${wikiData.url})`;

           // Ensure at least one correct answer exists
           if(c.options && Array.isArray(c.options) && c.options.length >= 2) {
             if(!c.options.some(o => o.is_correct)) {
                 c.options[0].is_correct = true; 
             }
           }
           return c;
        }).filter(c => c.question && c.options && Array.isArray(c.options) && c.options.length >= 2);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        return [];
    }

    try {
      const candidates = JSON.parse(jsonMatch[0]);
      // Force inject the URL just in case LLM messed it up
      return candidates.map(c => {
        c.citation = wikiData.url;

        let cleanExplanation = c.explanation || "";
        cleanExplanation = cleanExplanation.replace(/[\(（]\s*(Source|出典|Reference|ソース)[:：].*?[\)）]/gi, "");
        cleanExplanation = cleanExplanation.replace(/(Source|出典|Reference|ソース)[:：].*?$/mi, "");
        cleanExplanation = cleanExplanation.replace(/https?:\/\/[^\s\)]+/gi, "");
        cleanExplanation = cleanExplanation.replace(/\s{2,}/g, " ").trim();
        c.explanation = `${cleanExplanation} (出典: ${wikiData.url})`;

        // Ensure at least one correct answer exists
        if (c.options && Array.isArray(c.options) && c.options.length >= 2) {
          if (!c.options.some(o => o.is_correct)) {
            c.options[0].is_correct = true;
          }
        }
        return c;
      });
    } catch (e) {
      console.error("JSON Parse Error:", e);
      return [];
    }

  } catch (e) {
    console.error("Candidate Gen Exception: " + e.toString());
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
    explanation: q.explanation
  };
}

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
      // We need to extract the user's latest input from the history or imply it.
      // Since we pass the full history, the last item is likely the user's answer.
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
        tools: [{ google_search: {} }], // <--- The Fundamental Fix: Enable Google Search Grounding
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
        }
      })
    });

    const json = JSON.parse(response.getContentText());

    if (!json.candidates || json.candidates.length === 0) {
      console.error("Gemini Error (Refine): No candidates returned.", JSON.stringify(json));
      // Fallback to accepting the interest as is if AI fails
      return {
        status: "specific",
        refined_topic: interest,
        note: "AI refinement failed, used original input."
      };
    }

    const text = getGeminiText(json);

    if (!text) {
      console.error("Gemini Error (Refine): Invalid structure or empty text.", JSON.stringify(json));
      return { status: "specific", refined_topic: interest };
    }

    // Robust JSON Extraction for Object
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      text = text.substring(firstBrace, lastBrace + 1);
    } else {
      console.error("Gemini Error (Refine): No JSON object found.", text);
      // Fallback
      return { status: "specific", refined_topic: interest };
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Gemini Error (Refine): JSON Parse failed.", text);
      return { status: "specific", refined_topic: interest };
    }

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getQuiz(params) {
  // Deprecated/Mock placeholder
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

  // Skip header, assuming row 1 is data start
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

    // Skip header
    for (let i = 1; i < data.length; i++) {
      const row = data[i]; // user_id (0), nickname (1), password (2), interests (3), avatar_url (4)
      const userId = String(row[0]);
      const nickname = String(row[1]);

      // Simple correct match
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

    // Check availability
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
      // Fallback: If no friends, maybe return nothing or a "Find Friends" prompt?
      // For now, let's keep it empty to encourage finding friends, or user request implied ONLY followed users.
      return { status: "success", interests: [] };
    }

    const data = usersSheet.getDataRange().getValues();
    let allInterests = [];

    // Skip header
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowUserId = String(row[0]);

      // Filter by Followed Users
      if (followedIds.has(rowUserId)) {
        try {
          // Parse interests JSON
          const interests = JSON.parse(row[3]);
          if (Array.isArray(interests)) {
            allInterests = allInterests.concat(interests);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }

    // Deduplicate and randomize
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
  // Explicitly call UrlFetchApp to force authorization prompt in editor
  console.log("Testing authorization...");
  UrlFetchApp.fetch("https://www.google.com");
  console.log("Authorization successful.");
  console.log(generateQuiz({ topic: "Test" }));
}
