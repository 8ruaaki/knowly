function setupDatabase() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const sheets = [
        { name: 'Users', headers: ['user_id', 'nickname', 'icon_url', 'interests', 'badges'] },
        { name: 'Quiz_Sessions', headers: ['session_id', 'provider_id', 'learner_id', 'topic', 'current_level', 'is_revealed'] },
        { name: 'Path_Messages', headers: ['message_id', 'from_id', 'to_id', 'content', 'status'] }
    ];

    sheets.forEach(details => {
        let sheet = ss.getSheetByName(details.name);
        if (!sheet) {
            sheet = ss.insertSheet(details.name);
            sheet.appendRow(details.headers);
        }
    });
}
