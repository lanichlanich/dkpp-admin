# Backup Google Drive

The dashboard backup creates a new `Backup YYYY-MM-DD_HH-mm-ss` folder (Jakarta time) inside the configured Drive folder. It contains feature folders for `Kepegawaian`, `Persuratan`, `Umum`, `Perencanaan`, and `Sistem`. Each feature folder has one ordinary `.tar.gz` archive with that feature's database tables and files from Supabase Storage. `Perencanaan` includes KAK DOCX files, source RKA PDFs, and associated PO DOCX files. Objects without a matching application document row are preserved in the `Sistem` archive and indexed there. Login sessions are omitted because they expire and cannot be restored as valid sessions.

New backups are **not encrypted** and can be extracted directly without a password or encryption key. Filenames inside archives use record IDs; employee and document data remain in the JSON snapshots and original documents. Keep the folder private: **General access / Akses umum must be Restricted / Dibatasi**. Before reading the snapshot or downloading files, the server checks OAuth access and folder write permission, and rejects public or domain-wide sharing. Individual permissions granted to intended backup administrators remain supported.

## Google Cloud and Vercel setup

1. In a Google Cloud project, enable the Google Drive API and configure the OAuth consent screen for the account that owns the destination folder.
2. Create an OAuth client ID for a Web app and add `https://developers.google.com/oauthplayground` as an authorized redirect URI. In OAuth Playground settings, select **Use your own OAuth credentials**, then enter that client ID and secret. Request `https://www.googleapis.com/auth/drive`, authorize the owner account, exchange the authorization code, and copy the refresh token. Google documents the offline authorization and token refresh flow [here](https://developers.google.com/identity/protocols/oauth2/web-server); Drive scope details are [here](https://developers.google.com/workspace/drive/api/guides/api-specific-auth). The `drive` scope is broad, so use this OAuth client only for this app and account.
3. If the consent screen is in Testing mode, Google can expire refresh tokens after seven days. Publish/configure the consent screen appropriately for the intended account before relying on unattended long-term access.
4. Add these variables in Vercel Project Settings → Environment Variables, then redeploy:
   - `GOOGLE_DRIVE_CLIENT_ID`: OAuth client ID.
   - `GOOGLE_DRIVE_CLIENT_SECRET`: matching OAuth client secret.
   - `GOOGLE_DRIVE_REFRESH_TOKEN`: offline refresh token for the Drive account that can write to the target folder. Copy the **Refresh token** field, not the access token or authorization code. It must be issued to the same OAuth client as the Client ID and Client Secret above.
   - `GOOGLE_DRIVE_BACKUP_ADMIN_USERNAMES`: comma-separated application usernames allowed to run backups, for example the actual administrator username. This allowlist is checked again in the server action.
   - `GOOGLE_DRIVE_BACKUP_FOLDER_ID`: optional; defaults to the folder ID supplied for DKPP-Admin.
5. Keep the Drive folder restricted to the owner and the intended backup account. Changing public access from Editor to Viewer still leaves the folder public; choose **Restricted / Dibatasi** under General access and save.

`GOOGLE_DRIVE_BACKUP_ENCRYPTION_KEY` is no longer required or used for new backups. Never put OAuth secrets or tokens in chat, source control, or `NEXT_PUBLIC_` variables. Keep any old encryption key privately if you have older encrypted archives.

The Drive API uses resumable uploads with `application/gzip` for the feature archives. See Google's [Drive upload guide](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

## Troubleshooting OAuth

Use **Periksa koneksi** on the dashboard to validate OAuth and private-folder access without reading database snapshots, downloading Storage files, or uploading archives.

- **`invalid_client`**: Google rejected the client credentials. Enter Client ID and Client Secret from the same OAuth client in Vercel **Production**, then redeploy.
- **`invalid_grant`**: Google rejected the refresh token. It may be invalid, revoked, expired, or issued to another client. Verify the OAuth Playground client settings, obtain/copy the correct **Refresh token**, update Vercel Production, and redeploy. Google's [refresh token expiration documentation](https://developers.google.com/identity/protocols/oauth2#expiration) explains expiration and revocation.
- **Other HTTP errors**: verify all three variables and retry if Google is temporarily unavailable. The app reports the HTTP status and known OAuth error codes without exposing Google's raw response or credentials.
- **Private folder required**: set General access to **Restricted / Dibatasi** in the destination folder's Share dialog and save. The app refuses an unencrypted backup to a public or domain-wide folder.

## Recovering an archive

Download a `.tar.gz` archive and extract it directly, for example:

```powershell
tar -xzf backup-kepegawaian.tar.gz
```

The extracted tar contains `database/<table>.json` snapshots and `files/<table>/record-<id>.<ext>` objects. Restore the Supabase schema from the repository migrations first, then import table rows in foreign-key order and put document objects back into the `dkpp-admin` bucket using the `storage_name` values in their table snapshots. The unlinked-storage index records original object names.

For older `.tar.gz.enc` archives only, run `node scripts/decrypt-google-drive-backup.mjs <archive.tar.gz.enc> <archive.tar.gz>` locally with the original `GOOGLE_DRIVE_BACKUP_ENCRYPTION_KEY`. The old decryption helper is retained for compatibility.
