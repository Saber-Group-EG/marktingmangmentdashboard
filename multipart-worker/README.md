# R2 Multipart Upload Worker

Handles multipart uploads to Cloudflare R2 from the browser.

## Setup

1. Update `wrangler.toml` with your R2 bucket name
2. Run `npm install`
3. Run `npm run deploy`

## Endpoints

- `POST /multipart/create` — `{ key }` → `{ key, uploadId }`
- `PUT /multipart/part?key=&uploadId=&partNumber=` — binary body → `{ partNumber, etag }`
- `POST /multipart/complete` — `{ key, uploadId, parts }` → `{ key, etag, publicUrl }`
- `POST /multipart/abort` — `{ key, uploadId }` → `{ aborted: true }`
