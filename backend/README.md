# Knowly Backend Deployment

1. Create a new Google Sheet.
2. Go to `Extensions` > `Apps Script`.
3. Copy the content of `Code.js` into the script editor (rename default file to `Code.gs` if you want).
4. Create a new file named `schema_setup.gs` and copy the content of `schema_setup.js`.
5. Run the `setupDatabase` function once to create the sheets.
6. Deploy as Web App:
   - Click `Deploy` > `New deployment`.
   - Select type: `Web app`.
   - Description: `Knowly API v1`.
   - Execute as: `Me`.
   - Who has access: `Anyone` (or `Anyone with Google account` depending on your needs).
   - Copy the `Web App URL`.
