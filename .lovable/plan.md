

## Plan: Admin UI for Bunny Migration + Fix Edge Functions + Reactivate URL Rewrite

### Problem Found
Both `upload-to-bunny` and `migrate-to-bunny` edge functions use `supabase.auth.getClaims(token)` which **does not exist** in supabase-js v2. This is why you couldn't use the migration even when logged in as admin. The correct method is `supabase.auth.getUser()`.

### Changes

#### 1. Fix auth in both edge functions
Replace `getClaims` with `getUser()` in:
- `supabase/functions/upload-to-bunny/index.ts`
- `supabase/functions/migrate-to-bunny/index.ts`

Pattern change:
```typescript
// BEFORE (broken)
const { data: claimsData } = await supabase.auth.getClaims(token);
const userId = claimsData.claims.sub;

// AFTER (working)
const { data: { user }, error } = await supabase.auth.getUser(token);
const userId = user.id;
```

#### 2. Add Bunny Migration UI to MediaSettings
Add a new Card to `src/components/admin/settings/MediaSettings.tsx` with 3 buttons matching the 3 actions:

- **Ver Status** — calls `migrate-to-bunny` with `{ action: "status" }`, shows file counts per bucket and unmigrated URL counts
- **Migrar Arquivos** — calls with `{ action: "migrate_files", batch_size: 20 }`, shows progress, supports repeated clicks with auto-incrementing offset
- **Atualizar URLs no Banco** — calls with `{ action: "update_urls" }`, shows how many URLs were updated per table

Each button shows results inline (same pattern as the existing WebP conversion and import cards).

#### 3. Reactivate URL rewrite in imageUtils.ts
Uncomment the Supabase→Bunny rewrite block in `getOptimizedImageUrl()`. After migration completes, all Supabase URLs in the DB will be replaced, and any remaining ones in cached pages will be rewritten client-side.

#### 4. Update AI edge functions to upload to Bunny (Phase 5)
Update 3 edge functions that still save images to Supabase Storage:
- `generate-blog-post-v2/index.ts` (line ~641)
- `regenerate-blog-image/index.ts` (line ~211)
- `generate-multi-event-article/index.ts` (line ~400)

Each will replace `supabase.storage.from('event-images').upload()` + `getPublicUrl()` with a direct `PUT` to `br.storage.bunnycdn.com/mdacula/event-images/{filename}` using the `BUNNY_STORAGE_API_KEY` secret (already configured).

### Status After Implementation

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Edge function upload-to-bunny | Done (fix auth) |
| 2 | 7 upload forms use Bunny | Done |
| 3 | Migration tool + Admin UI | Done (fix auth + add UI) |
| 4 | Reactivate URL rewrite | Done |
| 5 | AI edge functions use Bunny | Done |

After this, the full Bunny Storage migration is **complete**. No Cloudflare changes needed.

