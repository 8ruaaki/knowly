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

    const prompt = `
      Generate a 5-question multiple choice quiz about "${topic}".
      Target Audience: Japanese speakers.
      Difficulty Level: ${difficulty}/10.

      DIFFICULTY GUIDELINES:
      - Level 1-3: Basic facts, famous works, intro-level knowledge. (e.g., "Who is the main character?", "What year was it released?")
      - Level 4-6: Intermediate details, plot points, specific terminology. (e.g., "What is the name of the sword?", "Who directed the sequel?")
      - Level 7-10: Expert trivia, behind-the-scenes facts, obscure lore, production history. (e.g., "What was the budget?", "Who was the original actor cast?", "Specific dates/numbers")
      
      ${exclusionText}

      CRITICAL PROCESS:
      1. Think about the question.
      2. PRE-FILTER: Discard any question that relies on obscure theories, minor details with conflicting sources, or ambiguous definitions. Use ONLY "High Consensus" facts.
      3. Select ONE correct answer.
      4. FACT CHECK: Verify the correct answer against your database. If there is ANY doubt or ambiguity, choose a different question.
      4. Create 3 distractors.
      5. SELF-VERIFICATION: Ensure the correct answer is indisputable and distractors are clearly wrong.
      
      Return ONLY a raw JSON array.
      output format:
      [
        {
          "question": "string (in Japanese)",
          "options": [
            { "text": "string (Correct Option)", "is_correct": true },
            { "text": "string (Wrong Option 1)", "is_correct": false },
            { "text": "string (Wrong Option 2)", "is_correct": false },
            { "text": "string (Wrong Option 3)", "is_correct": false }
          ],
          "explanation": "string (short explanation + 'Source: [URL]')",
          "citation": "string (URL of the verification source)"
        }
      ]
      
      RULES FOR EXPLANATION:
      - Append the source URL at the end of the explanation if available.
      - Format: '... (Source: https://example.com)'
    `;

    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return { status: "error", message: "GEMINI_API_KEY not configured in Script Properties" };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      }
    };

    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload)
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const json = JSON.parse(response.getContentText());

    if (!json.candidates || json.candidates.length === 0) {
      console.error("Gemini Error: No candidates returned.", JSON.stringify(json));
      return { status: "error", message: "Gemini could not generate a quiz. Please try again. (Safety filter or overload)" };
    }

    // Extract text from Gemini response
    let text = json.candidates[0].content.parts[0].text;

    // Robust JSON Extraction: Find first '[' and last ']'
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1) {
      text = text.substring(firstBracket, lastBracket + 1);
    } else {
      throw new Error("No JSON array found in response");
    }

    // Attempt to fix common JSON errors (e.g., bad escapes)
    // specific fix for "Bad Unicode escape": double escape backslashes that are strictly not part of a valid escape sequence?
    // Actually, simple JSON.parse is usually fine if we isolate the array.
    // If "Bad Unicode escape" persists, it means the model output '\' instead of '\\'.
    // Let's try parsing directly first.
    let rawQuizData;
    try {
      rawQuizData = JSON.parse(text);
    } catch (e) {
      // Fallback: Escape backslashes if standard parse fails
      // This is risky but often fixes single backslashes in text
      // text = text.replace(/\\/g, '\\\\'); 
      // Better: Just log and re-throw for now, as blind replacement breaks valid escapes like \n
      console.error("JSON Parse Error Payload:", text);
      throw e;
    }

    // Transform to standard format (array of strings + correct_index)
    const quizData = rawQuizData.map(q => {
      let optionsNodes = [...q.options]; // Create a copy to shuffle

      // Fisher-Yates Shuffle
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
    });

    return {
      status: "success",
      topic: topic,
      level: difficulty,
      questions: quizData
    };

  } catch (e) {
    return { status: "error", message: "Gemini Error: " + e.toString() };
  }
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

    let text = json.candidates[0].content.parts[0].text;

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
