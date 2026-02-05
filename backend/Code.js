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

    // Only increment if we just cleared the highest available level, and max is 10
    if (currentLevel === currentMax && currentMax < 10) {
      const newMax = currentMax + 1;
      if (rowIndex === -1) {
        sheet.appendRow([userId, topic, newMax, new Date()]);
      } else {
        sheet.getRange(rowIndex, 3).setValue(newMax);
        sheet.getRange(rowIndex, 4).setValue(new Date());
      }
      return { status: "success", unlocked: true, new_max_level: newMax };
    }

    return { status: "success", unlocked: false };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function generateQuiz(params) {
  try {
    const topic = params.topic || "General Knowledge";
    const difficulty = params.difficulty || 1;

    const prompt = `
      Generate a 5-question multiple choice quiz about "${topic}".
      Target Audience: Japanese speakers.
      Difficulty Level: ${difficulty}/10.
      - Level 1: Basic definitions, simple facts.
      - Level 5: Intermediate concepts, application.
      - Level 10: Advanced analysis, obscure details, complex scenarios.
      
      Return ONLY a raw JSON array (no markdown formatting).
      output format:
      [
        {
          "question": "string (in Japanese)",
          "options": [
            { "text": "string (Option A)", "is_correct": boolean },
            { "text": "string (Option B)", "is_correct": boolean },
            { "text": "string (Option C)", "is_correct": boolean },
            { "text": "string (Option D)", "is_correct": boolean }
          ],
          "explanation": "string (short explanation, in Japanese)"
        }
      ]
    `;

    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return { status: "error", message: "GEMINI_API_KEY not configured in Script Properties" };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload)
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const json = JSON.parse(response.getContentText());

    // Extract text from Gemini response
    let text = json.candidates[0].content.parts[0].text;

    // Clean up markdown if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const rawQuizData = JSON.parse(text);

    // Transform to standard format (array of strings + correct_index)
    const quizData = rawQuizData.map(q => {
      const optionsNodes = q.options;
      const optionsText = optionsNodes.map(o => o.text);
      const correctIndex = optionsNodes.findIndex(o => o.is_correct);
      return {
        question: q.question,
        options: optionsText,
        correct_index: correctIndex !== -1 ? correctIndex : 0, // Fallback to 0 if none marked TRUE (shouldn't happen)
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

    const prompt = `
      You are a helpful assistant for a Quiz App called "Knowly". 
      A user has entered an interest: "${interest}".
      Your goal is to ensure the topic is specific enough to generate a fun, challenging trivia quiz.

      ${historyText}
      
      Rules:
      Rules:
      1. If the topic is broad (e.g., "Music", "History", "Science", "Sports", "Movies", "Food", "Travel", "Art", "Technology", "Animals", "Zelda"), return 'broad'.
      2. If the topic is valid but has many sub-genres (e.g., "Rock", "Pop", "Anime", "Video Games"), return 'broad'.
      3. ACCEPT MODERATELY SPECIFIC TOPICS: If the topic is a "Field + Subfield" or "Language + Topic" combination (e.g., "Python Data Science", "Java Web Development", "History of Rome", "90s Rock"), return 'specific'.
      4. ONLY return 'broad' if the topic is truly too vague to make a good quiz.
      5. Clarification questions MUST focus on narrowing down to a factual TRIVIA CATEGORY.
      6. CRITICAL: Phrase your question as if asking the user what they are knowledgeable about or want to take a quiz on.
      4. Clarification questions MUST focus on narrowing down to a factual TRIVIA CATEGORY.
      5. CRITICAL: Phrase your question as if asking the user what they are knowledgeable about or want to take a quiz on. 
         - BAD: "What do you want to know about Zelda?" (User is not asking YOU).
         - GOOD: "Which Zelda game is your favorite?" or "Which specific title should we make a quiz for?"
      6. Question MUST be in Japanese (e.g., "いいですね！シリーズの中で『一番詳しい作品』はどれですか？", "クイズにするなら、どの『時代』が良いですか？").
      
      Return ONLY raw JSON:
      {
        "status": "broad" | "specific",
        "question": "string (Japanese clarification question, must be present if broad)",
        "refined_topic": "string (The cleaned up topic name)"
      }
    `;

    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    const response = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    let text = JSON.parse(response.getContentText()).candidates[0].content.parts[0].text;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(text);

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
