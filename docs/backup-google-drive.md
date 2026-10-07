# Backup Google Drive

The dashboard backup creates a new `Backup YYYY-MM-DD_HH-mm-ss` folder (Jakarta time) inside the configured Drive folder. It contains feature folders for `Kepegawaian`, `Persuratan`, `Umum`, and `Sistem`. Each feature folder has one encrypted `.tar.gz.enc` archive with that feature's database tables and files from Supabase Storage. Objects without a matching application document row are preserved in the `Sistem` archive and indexed there. Login sessions are omitted because they expire and cannot be restored as valid sessions.

Each archive is encrypted on the server with AES-256-GCM before upload. Filenames inside archives use record IDs; employee and document names remain in the encrypted database snapshots. Keep the encryption key in a secure password manager and never commit it or send it in chat. Losing this key makes the backups unreadable.

## Google Cloud and Vercel setup

1. In a Google Cloud project, enable the Google Drive API and configure the OAuth consent screen for the account that owns the destination folder.
2. Create an OAuth client ID for a Web app and add `https://developers.google.com/oauthplayground` as an authorized redirect URI. In OAuth Playground settings, select **Use your own OAuth credentials**, then enter that client ID and secret. Request `https://www.googleapis.com/auth/drive`, authorize the owner account, exchange the authorization code, and copy the refresh token. Google documents the offline authorization and token refresh flow [here](https://developers.google.com/identity/protocols/oauth2/web-server); Drive scope details are [here](https://developers.google.com/workspace/drive/api/guides/api-specific-auth). The `drive` scope is broad, so use this OAuth client only for this app and account.
3. If the consent screen is in Testing mode, Google can expire refresh tokens after seven days. Publish/configure the consent screen appropriately for the intended account before relying on unattended long-term access.
4. Add these variables in Vercel Project Settings → Environment Variables, then redeploy:
   - `GOOGLE_DRIVE_CLIENT_ID`: OAuth client ID.
   - `GOOGLE_DRIVE_CLIENT_SECRET`: matching OAuth client secret.
   - `GOOGLE_DRIVE_REFRESH_TOKEN`: offline refresh token for the Drive account that can write to the target folder.
   - `GOOGLE_DRIVE_BACKUP_ENCRYPTION_KEY`: Base64 output of 32 random bytes. Generate locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` and store a protected copy outside Vercel.
   - `GOOGLE_DRIVE_BACKUP_ADMIN_USERNAMES`: comma-separated application usernames allowed to run backups, for example the actual administrator username. This allowlist is checked again in the server action.
   - `GOOGLE_DRIVE_BACKUP_FOLDER_ID`: optional; defaults to the folder ID supplied for DKPP-Admin.
5. Keep the Drive folder restricted to the owner and the intended backup account. The supplied folder link currently grants writer access to anyone with the link; encryption protects archive contents, but that permission still allows others to delete or replace backup files.

The Drive API uses resumable uploads for the encrypted feature archives. See Google's [Drive upload guide](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

## Recovering an archive

Download one `.tar.gz.enc` archive and run `node scripts/decrypt-google-drive-backup.mjs <archive.tar.gz.enc> <archive.tar.gz>` locally with `GOOGLE_DRIVE_BACKUP_ENCRYPTION_KEY` set to the same Base64 key. The extracted tar contains `database/<table>.json` snapshots and `files/<table>/record-<id>.<ext>` objects. Restore the Supabase schema from the repository migrations first, then import table rows in foreign-key order and put document objects back into the `dkpp-admin` bucket using the `storage_name` values in their encrypted table snapshots.
