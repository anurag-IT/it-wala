# Supabase and Cloudinary

The admin server keeps its existing local files for static-site rendering and as backups. When configured, Supabase supplies published CMS records to the admin and receives CMS publishes; Cloudinary receives new admin uploads and can hold copies of existing media. Neither integration removes local files.

## Configure secrets

Use newly rotated credentials. The API secret and Supabase service-role key must remain server-side; do not place them in browser code or commit them. Add these variables to the git-ignored `.env.admin` file or the deployment environment:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<rotated-service-role-key>
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<rotated-api-key>
CLOUDINARY_API_SECRET=<rotated-api-secret>
```

`CLOUDINARY_URL=cloudinary://<api-key>:<api-secret>@<cloud-name>` is also supported. Explicit Cloudinary variables take precedence.

The browser-facing Supabase publishable/anon key and direct PostgreSQL connection string are not needed by this server-side integration.

## Supabase

1. Run `server/sql/itwd_cms_content.sql` in the Supabase SQL editor. It only creates the CMS table if it is absent and enables row-level security; it does not drop or clear tables.
2. Run `npm run supabase:sync` to import the current local CMS JSON records. The import inserts only missing record types and leaves existing Supabase rows unchanged.
3. The admin reads a record from Supabase when it exists and otherwise uses the local copy. Publishing CMS data updates the local static site first, then updates that Supabase record. A sync error is reported explicitly; the local publish and local data remain intact.

## Cloudinary

Run `npm run cloudinary:migrate` to copy supported existing images to Cloudinary. Each successful copy is recorded in `content/media.json`, while local originals and existing page references remain unchanged. The script is safe to rerun and skips images already recorded as copied. Newly uploaded images are stored both locally and on Cloudinary; the admin uses the Cloudinary URL while preserving a local backup.

Use the authenticated `GET /api/integrations/check` endpoint to verify configured service credentials and Supabase table availability.
