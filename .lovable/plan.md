

## Plan: Fix Bunny 401 — Wrong Region Hostname

### Root Cause
From Bunny's official docs: HTTP 401 means "Invalid AccessKey, **region hostname**, or non-binary file format." The password is correct, but the code hardcodes `br.storage.bunnycdn.com`. If the storage zone `mdacula` was created in the default region (Falkenstein), the correct hostname is `storage.bunnycdn.com` — NOT `br.storage.bunnycdn.com`. Using the wrong region returns 401.

### Fix

#### 1. Add auto-detection in `migrate-to-bunny` diagnose action
Instead of testing only one endpoint, the `diagnose` action will try ALL Bunny region endpoints in sequence:
- `storage.bunnycdn.com` (Falkenstein — default)
- `br.storage.bunnycdn.com` (São Paulo)
- `ny.storage.bunnycdn.com`, `la.storage.bunnycdn.com`, `uk.storage.bunnycdn.com`, `sg.storage.bunnycdn.com`, `se.storage.bunnycdn.com`, `jh.storage.bunnycdn.com`, `syd.storage.bunnycdn.com`

The first one that returns 200 is the correct region. The UI will show which region was detected.

#### 2. Add `BUNNY_STORAGE_HOSTNAME` secret
Once detected, save the correct hostname as a new Supabase secret `BUNNY_STORAGE_HOSTNAME`. All edge functions will read this secret at runtime instead of hardcoding `br.storage.bunnycdn.com`.

#### 3. Update all 6 edge functions to use the secret
Replace the hardcoded constant in:
- `migrate-to-bunny/index.ts`
- `upload-to-bunny/index.ts`
- `batch-convert-webp/index.ts`
- `generate-blog-post-v2/index.ts`
- `regenerate-blog-image/index.ts`
- `generate-multi-event-article/index.ts`

Pattern:
```typescript
// BEFORE
const BUNNY_STORAGE_HOST = `https://br.storage.bunnycdn.com`;

// AFTER
const BUNNY_STORAGE_HOST = Deno.env.get("BUNNY_STORAGE_HOSTNAME") 
  ? `https://${Deno.env.get("BUNNY_STORAGE_HOSTNAME")}` 
  : "https://storage.bunnycdn.com"; // fallback to default region
```

#### 4. Update MediaSettings UI
Show the detected region in the diagnostics card so the user can confirm.

### Files changed
- `supabase/functions/migrate-to-bunny/index.ts` — add region auto-detection + use secret
- `supabase/functions/upload-to-bunny/index.ts` — use secret
- `supabase/functions/batch-convert-webp/index.ts` — use secret
- `supabase/functions/generate-blog-post-v2/index.ts` — use secret
- `supabase/functions/regenerate-blog-image/index.ts` — use secret
- `supabase/functions/generate-multi-event-article/index.ts` — use secret
- `src/components/admin/settings/MediaSettings.tsx` — show detected region

### External step
After running Diagnóstico Completo and seeing the detected region, you'll need to add the `BUNNY_STORAGE_HOSTNAME` secret in Supabase with the correct value (e.g. `storage.bunnycdn.com`).

