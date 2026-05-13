# AI Auto-Tagging Pipeline Plan

_Generated from session `ses_1f583f41affePOQ7EWVdRAf7lz` — "SSH prod DB: post counts and tag distribution questions"_

---

## Background & Findings

### Current state (from prod DB query)
- **4,085 total posts**
- **3,562 posts have tags** (87.2%)
- **523 posts have no tags** (12.8%) — primary target for the batch job
- **204 unique tags** — well-bounded vocabulary, most are visually observable
- Each post has **1–6 tags** (multi-label classification problem)
- Each post is a set of **~30–70 images** (360×360 thumbnails on prod server)

### Tag vocabulary characteristics
- Most tags are image-observable: `nude`, `beach`, `lingerie`, `stockings`, `school uniform`, `glasses`, `ponytail`, `bikini`, etc. — CLIP-friendly
- Some are domain-specific: `hilichurl` (Genshin character), `voting winner`, `manhwa` — these require non-vision signals
- Some correlate strongly with title keywords: `voting winner` almost always has "voting winner" in the post title
- Some correlate with character/series metadata

### Existing architecture (don't reinvent)
- `post_edits` table + `edit_service` handles the community suggest → approve → apply → history pipeline
- `edit_history` table stores every tag change with who approved it
- `AdminPostModal.jsx` has existing tag editing UI with autocomplete
- `generate_tags()` in `backend/import_posts.py` exists but is dead code (not called by the current import script `scripts/import_posts_local.py`)

---

## Design Decisions

### Separate `ai_tag_suggestions` table (not piggybacking on `post_edits`)
Reasons:
- Different trust level than community edits
- Needs to store `confidence` score and `model_version` — no concept of this in `post_edits`
- Different UI treatment (distinct "AI Suggestions" panel, not mixed with human edits)
- When **accepted**, it calls the existing tag-update logic and writes an `edit_history` entry (audit trail preserved)

### Three signal sources, combined
1. **CLIP vision** (primary) — average image embeddings per post, cosine similarity vs. all 204 tag name text embeddings
2. **Title rules** (high precision, zero cost) — keyword/phrase matching on post title, e.g. `"voting winner"` in title → suggest `voting winner` tag; extend the existing `generate_tags()` logic properly
3. **Character co-occurrence** (medium precision) — for each character on the post, look up which tags appear in ≥70% of posts with that character in the DB, and suggest those

### Model choice: CLIP ViT-B/32 via `open_clip`
- Works zero-shot (no training needed to start)
- 360px thumbnails are fine — CLIP resizes to 224px internally anyway, no quality gain from higher res
- Run on **this local machine** (AMD GPU + ROCm 5.6.0 installed)
- PyTorch + ROCm not yet installed — needs setup (see Phase 1 notes below)

### Image sources
| Use case | Source | Path |
|---|---|---|
| Batch job (existing posts) | Local copy | `~/patreon-test/VAMA - VAMA/posts/{post_id}*/images/*.png` |
| New post imports | Downloaded thumbnails | `~/.vamasubmissions_import/{session}/thumbnails/` |

Local copy coverage: **4,101 post folders with images** vs 4,085 in DB — essentially complete. No NAS needed.

Total images locally: ~188k across 4,101 posts (~46 images/post average).

---

## Implementation Plan

### Phase 1 — Environment setup + tagging script ✅ COMPLETE

**Environment (done):**
- `.venv` at project root (note: `.venv/` added to `.gitignore`)
- PyTorch 2.2.2+rocm5.6, open-clip-torch 3.3.0, numpy 1.26.4, psycopg2-binary installed
- GPU: AMD Radeon gfx1032 (RX 6400/6500 series)
- **Known fix:** `HSA_OVERRIDE_GFX_VERSION=10.3.0` required — set automatically at top of script

**`scripts/generate_ai_tags.py` written and validated.**

Key flags:
```
--mode batch/post       # batch = multiple posts, post <post_id> = single post
--all                   # include already-tagged posts (default: untagged only)
--tagged-only           # only tagged posts, random order (validation use)
--images-dir <path>     # default: ~/patreon-test/VAMA - VAMA/posts
--db-url <url>          # default: postgresql:///vamasubmissions_prod
--output <file>         # default: suggestions.json
--dry-run               # print to stdout, don't write file
--threshold <float>     # CLIP cosine similarity floor (default: 0.25)
--limit <n>             # cap posts processed
--no-clip               # skip CLIP, title rules + co-occurrence only
```

To refresh local prod DB copy:
```bash
ssh -o LogLevel=ERROR deploy@vama "sudo -u postgres pg_dump --no-owner --no-acl vamasubmissions" > /tmp/vama_prod.sql
dropdb --if-exists vamasubmissions_prod && createdb vamasubmissions_prod
psql -d vamasubmissions_prod -f /tmp/vama_prod.sql
```

**Validation results (full 3,562 tagged posts):**

CLIP zero-shot performance is highly tag-dependent. Tags split into two groups:

*CLIP-friendly (avg_rank < 15, reliable in top-10):*
`onsen`, `maid`, `christmas`, `cow girl`, `shower`, `wet clothes`, `microkini`, `bunny girl`,
`milking`, `nurse`, `sauna`, `pool`, `beach`, `swimsuit`, `halloween`, `cheerleader`,
`classroom`, `yukata`, `bathtub`, `futa`, `ahegao`, `squirting`

*CLIP-blind (avg_rank > 80, 0/n in top-10):*
`gloves`, `solo`, `fishnets`, `yuri`, `sex tattoo`, `lingerie`, `love hotel`, `elf`, `braids`,
`student uniform`, `long hair`, `dark skin`, `voting winner`, `hilichurl`, `pantyhose`,
`drill hair`, `stadium`, `heels`, `trench coat`, `FFM`, `ninja`, `clone`, `tattoos`,
`evening gown`, `toys`

Score distribution is flat (0.25–0.31) — a score threshold is unreliable. Use **top-N by rank** instead.

**Pending script update (do before Phase 2):**
- Add `--clip-whitelist` mode: only score CLIP-friendly tags, use top-10 by rank
- Tags outside whitelist handled by title rules and co-occurrence only

---

### Phase 2 — DB migration + batch push

**Migration `023_add_ai_tag_suggestions.sql`:**

```sql
CREATE TABLE ai_tag_suggestions (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    confidence FLOAT NOT NULL,
    source VARCHAR(50) NOT NULL,         -- 'clip', 'title_rule', 'char_cooccurrence'
    model_version TEXT,                  -- e.g. 'clip-vit-b32-v1', null for rule-based
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, tag)                 -- one suggestion per tag per post
);
CREATE INDEX ON ai_tag_suggestions(post_id, status);
```

**Push script:** reads `suggestions.json`, SSHes to prod, bulk-inserts into `ai_tag_suggestions`. Then run batch on 523 untagged posts.

---

### Phase 3 — Backend API

New router `backend/app/api/ai_tags.py`:

```
GET  /api/posts/{post_id}/ai-tag-suggestions
     → returns pending suggestions sorted by confidence desc

POST /api/posts/{post_id}/ai-tag-suggestions/{id}/accept
     → adds tag to posts.tags[]
     → writes edit_history entry (suggester_id=NULL or system user, approver_id=current admin)
     → marks suggestion status='accepted'

POST /api/posts/{post_id}/ai-tag-suggestions/{id}/reject
     → marks suggestion status='rejected'
```

---

### Phase 4 — Frontend: AdminPostModal changes

Add an **"AI Suggestions" panel** to `AdminPostModal.jsx`, rendered above the existing tag input section. Only shown when there are pending suggestions.

- Each suggestion displayed as a chip: `beach 94% [clip]`
- Visually distinct from confirmed tag badges (e.g. dashed border, different background color)
- Two buttons per suggestion: ✓ Accept / ✗ Reject
- Accepting optimistically adds the tag to the displayed tag list
- Panel disappears once all suggestions are reviewed

---

### Phase 5 — Import pipeline integration

In `scripts/import_posts_local.py`, after `download_thumbnails()` returns and before `create_sql_file()`:

```python
# Generate AI tag suggestions for newly imported posts
generate_ai_tags(post_ids, thumbnails_dir, push_to_db=True)
```

New posts will arrive in the admin queue already pre-populated with AI suggestions, reducing tagging work to accept/reject rather than type from scratch.

---

### Phase 6 — Fine-tuned classifier (after Phase 5 is live)

The existing 3,562 labeled posts are sufficient to train now — no need to wait for accept/reject accumulation.

- Pre-compute CLIP ViT-L/14 image embeddings for all labeled posts
- Train a 204-output sigmoid classification head on frozen embeddings (multi-label)
- ~50–100 examples per tag needed for reliable performance — common tags already meet this bar
- Rare tags (`squirting`, `laundromat`, `futa`) will improve as new posts are reviewed via the UI
- Replaces zero-shot cosine similarity entirely — much better on CLIP-blind tags like `dark skin`, `lingerie`, `gloves`
- Retrain periodically as tag vocabulary grows

**Sequence:** Do this after Phase 5 is live and pipeline is validated end-to-end. The accept/reject UI data improves future retraining but is not required to start.

---

## Notes & Caveats

- The session was killed during PyTorch/ROCm setup (numpy conflict + GPU not detected). **Start fresh in a venv** and pin `numpy<2.0` before installing torch.
- ROCm version on this machine: **5.6.0** — use the `rocm5.6` PyTorch wheel index
- The `generate_tags()` function in `backend/import_posts.py` is dead code — the current `scripts/import_posts_local.py` doesn't call it. The title rules in the new script should replace/extend this properly.
- thevault is the **NAS** (Synology) — do not install Python packages or run inference there
- 360px thumbnails are sufficient for CLIP inference — no need to use 1080px or full-res images
- Next migration number is **023**
