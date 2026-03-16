

## Root Cause

The code never calls `.trim()` on the `BUNNY_STORAGE_API_KEY` secret. When secrets are pasted into the Supabase dashboard, it's extremely common for trailing whitespace, newlines, or carriage returns to be included. This causes the `AccessKey` header to contain invisible characters, which Bunny rejects as invalid — returning 401 for every region.

Additionally, the `Accept: "application/json"` header is being sent on the detection requests. The Bunny docs example only uses `AccessKey`. While unlikely to cause a 401, removing it aligns the request exactly with Bunny's documented curl example.

## Fix

### 1. Trim the API key everywhere it's read from env (`migrate-to-bunny/index.ts`)

```typescript
// BEFORE
const bunnyApiKey = Deno.env.get("BUNNY_STORAGE_API_KEY");

// AFTER  
const bunnyApiKey = Deno.env.get("BUNNY_STORAGE_API_KEY")?.trim();
```

### 2. Add detailed debug logging to `detectBunnyRegion`

Log the response body from the first failed attempt so we can see exactly what Bunny says. Also log the key length after trim to confirm the secret was loaded.

### 3. Apply `.trim()` in all 6 edge functions

- `migrate-to-bunny/index.ts`
- `upload-to-bunny/index.ts`
- `batch-convert-webp/index.ts`
- `generate-blog-post-v2/index.ts`
- `regenerate-blog-image/index.ts`
- `generate-multi-event-article/index.ts`

### 4. Match Bunny docs request format exactly

Remove `Accept: "application/json"` header from detection/auth-check requests. Only send `AccessKey`.

### 5. Add console.log diagnostics

Add logging in the diagnose action to capture:
- Key length after trim
- First response status + body text (truncated)
- URL being tested

This way if it still fails, the Edge Function logs will show exactly what Bunny returns.

### Files changed
- `supabase/functions/migrate-to-bunny/index.ts`
- `supabase/functions/upload-to-bunny/index.ts`
- `supabase/functions/batch-convert-webp/index.ts`
- `supabase/functions/generate-blog-post-v2/index.ts`
- `supabase/functions/regenerate-blog-image/index.ts`
- `supabase/functions/generate-multi-event-article/index.ts`

