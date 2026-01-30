# Project Plan - VAMA Community Tracker

**Last Updated**: 2026-01-28 12:33

## Current Status

Phase 1 + Post Import + SearchPage Refactoring + Browse Tab + Performance Optimizations + Production Deployment + Global Edits Refactor + Mobile UX Overhaul + Quick Wins + Centralized Text Content + **CDN Preparation (Phases 1-3) COMPLETE ✅**

Backend: 47+ active API endpoints (69 total including legacy), 2833 posts imported, full business logic implemented. Frontend: Fully responsive mobile-first design with hamburger navigation, improved touch targets (44px+), WCAG AA contrast compliance, and helpful empty states. SearchPage (refactored + Browse tab with "No Tags" filter), CommunityRequestsPage, ReviewEditsPage (3 tabs with consistent counts), ImportPostsPage (admin), AboutPage. Admin self-approval enabled. All features use non-blocking banner notifications. Real Patreon OAuth deployed. Performance optimizations eliminate N+1 queries (31 API calls → 1), reduce bandwidth by 85%. Global Edits use condition + action model with pattern matching, wildcards, preview, and undo. Desktop UI preserved through responsive design.

**CDN Preparation (Phases 1-4) Complete**: Thumbnail redownload script with parallel downloads (10x faster), UUID-based naming (`[postid]-t-[ordinal]-[uuid].ext`), idempotent/resumable, ready for production use. Import post feature updated to use same logic. See `scripts/README.md` for usage.

**Next Priority**: Frontend updates for multiple thumbnails (Phase 5).

---

## Business Rules

### Access Control
- Must be subscribed to VAMA's Patreon
- Must have active patron status (`patron_status == "active_patron"`)
- Must be in allowed tier whitelist (configurable via `ALLOWED_PATREON_TIER_IDS`)
- Tier detection preserved for future use
- All Phase 1 features available to all subscribers
- Admins bypass subscription checks

### Posts
- Source: vama_posts_initial.csv + Patreon imports
- Fields: post_id, timestamp, patreon_url, title, characters[], series[], tags[], thumbnail_url, thumbnail_urls[]
- Searchable: title, characters, series, tags (full-text + filters)
- Browse: Aggregated lists of characters, series, tags (with "No Tags" filter)
- Status: 'pending', 'published', 'skipped'

### Community Requests
- Unofficial queue tracking (not VAMA's official queue)
- Fields: characters[] (array), series[] (array), requested_timestamp, description, is_private, fulfilled
- Display: Sorted by requested_timestamp (oldest first), private requests obscured
- Actions: Users mark own fulfilled, admins can delete any

### Community Edits
- Editable: characters[], series[], tags[] on posts
- Actions: ADD, DELETE (typo fixes = delete + add)
- Workflow: Any subscriber suggests → different subscriber approves → immediately applied
  - Exception: Admins can approve their own suggestions
- Audit trail: All edits logged with suggester, approver, timestamp
- Admin can undo edits

### Global Edits
- Condition + Action model for bulk changes across posts
- Condition: field_name (which field to search) + pattern (what to match, supports wildcards)
- Action: action (ADD/DELETE) + action_field (which field to modify) + action_value (value to add, NULL for DELETE)
- Workflow: Any subscriber suggests → preview affected posts → different subscriber approves → immediately applied
  - Exception: Admins can approve their own suggestions
- Features: Pattern matching with wildcards, preview before approval, undo capability
- Audit trail: All global edits logged with previous values for undo

---

## Data Models

**Note**: This section shows only the active Phase 1 tables. Legacy tables (submissions, votes, etc.) exist but are not currently used. For complete schema, see the model files in `backend/app/models/`.

### Users
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    patreon_id VARCHAR(255) UNIQUE NOT NULL,
    patreon_username VARCHAR(255),
    tier_id VARCHAR(50),
    campaign_id VARCHAR(50),
    patron_status VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'patron',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login TIMESTAMP
);
```

### Posts
```sql
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    post_id VARCHAR(255) UNIQUE NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    patreon_url TEXT NOT NULL,
    title TEXT NOT NULL,
    characters TEXT[] DEFAULT '{}',
    series TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    thumbnail_url TEXT,
    thumbnail_urls TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'published',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX posts_search_idx ON posts USING GIN (to_tsvector('english', title || ' ' || array_to_string(characters, ' ') || ' ' || array_to_string(series, ' ') || ' ' || array_to_string(tags, ' ')));
CREATE INDEX idx_posts_status ON posts(status);
```

### Community Requests
```sql
CREATE TABLE community_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    characters TEXT[] NOT NULL DEFAULT '{}',
    series TEXT[] NOT NULL DEFAULT '{}',
    requested_timestamp TIMESTAMP NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    fulfilled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_requests_timestamp ON community_requests(requested_timestamp);
CREATE INDEX idx_requests_fulfilled ON community_requests(fulfilled);
CREATE INDEX idx_community_requests_characters_gin ON community_requests USING GIN (characters);
CREATE INDEX idx_community_requests_series_gin ON community_requests USING GIN (series);
```

### Post Edits
```sql
CREATE TABLE post_edits (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    suggester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(50) NOT NULL,
    action VARCHAR(10) NOT NULL,
    value TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP
);
CREATE INDEX idx_edits_status ON post_edits(status);
CREATE INDEX idx_edits_post ON post_edits(post_id);
```

### Edit History
```sql
CREATE TABLE edit_history (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    suggester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(50) NOT NULL,
    action VARCHAR(10) NOT NULL,
    value TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_history_post ON edit_history(post_id);
```

### Global Edit Suggestions
```sql
CREATE TABLE global_edit_suggestions (
    id SERIAL PRIMARY KEY,
    suggester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(50) NOT NULL,  -- Condition: which field to search
    pattern TEXT NOT NULL,  -- Condition: what to match (supports wildcards)
    action VARCHAR(10) NOT NULL DEFAULT 'ADD',  -- Action: 'ADD' or 'DELETE'
    action_field VARCHAR(50) NOT NULL,  -- Action: which field to modify
    action_value TEXT,  -- Action: value to add (NULL for DELETE)
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    previous_values JSONB,  -- For undo functionality
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    applied_at TIMESTAMP,
    CONSTRAINT check_field_name CHECK (field_name IN ('characters', 'series', 'tags')),
    CONSTRAINT check_status CHECK (status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT check_action CHECK (action IN ('ADD', 'DELETE')),
    CONSTRAINT check_action_value CHECK (
        (action = 'ADD' AND action_value IS NOT NULL) OR
        (action = 'DELETE' AND action_value IS NULL)
    )
);
CREATE INDEX idx_global_edits_status ON global_edit_suggestions(status);
CREATE INDEX idx_global_edits_suggester ON global_edit_suggestions(suggester_id);
CREATE INDEX idx_global_edits_created ON global_edit_suggestions(created_at DESC);
```

---

## API Endpoints

### Authentication
- `GET /api/auth/login` - Redirect to Patreon OAuth (supports mock auth with username param)
- `GET /api/auth/callback` - Handle OAuth callback, return JWT
- `POST /api/auth/logout` - Invalidate session
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/check-subscription` - Check Patreon subscription status

### Posts
- `GET /api/posts/search` - Search posts (q, page, limit, character, series, tag, title, order, no_tags)
- `GET /api/posts/{post_id}` - Get post details
- `GET /api/posts/browse/{field_type}` - Browse aggregated data (characters/series/tags)
- `GET /api/posts/autocomplete/characters` - Character autocomplete
- `GET /api/posts/autocomplete/series` - Series autocomplete
- `GET /api/posts/autocomplete/tags` - Tag autocomplete
- `GET /api/posts/autocomplete/characters-with-series` - Character autocomplete with series info

### Community Requests
- `POST /api/requests/` - Create request
- `GET /api/requests/` - List all requests (page, limit, include_fulfilled)
- `GET /api/requests/my` - List user's own requests (include_fulfilled)
- `PATCH /api/requests/{id}` - Update request
- `PATCH /api/requests/{id}/fulfill` - Mark own request fulfilled
- `DELETE /api/requests/{id}` - Delete request (own or admin)

### Post Edits
- `POST /api/edits/suggest` - Suggest edit (post_id, field_name, action, value)
- `GET /api/edits/pending` - List pending edits
- `GET /api/edits/pending-for-post/{post_id}` - Get pending edits for single post
- `GET /api/edits/pending-for-posts` - Batch query for pending edits (post_ids param)
- `POST /api/edits/{id}/approve` - Approve edit (admins can approve own)
- `POST /api/edits/{id}/reject` - Reject edit
- `GET /api/edits/history` - Get edit history (optional post_id filter)
- `POST /api/edits/history/{history_id}/undo` - Undo edit (admin only)

### Global Edits
- `POST /api/global-edits/preview` - Preview affected posts (field_name, pattern params)
- `POST /api/global-edits/suggest` - Create global edit suggestion (pattern, action, action_field, action_value)
- `GET /api/global-edits/pending` - List pending global edits
- `GET /api/global-edits/{id}/preview` - Get preview for specific suggestion
- `POST /api/global-edits/{id}/approve` - Approve and apply bulk changes (admins can approve own)
- `POST /api/global-edits/{id}/reject` - Reject suggestion
- `GET /api/global-edits/history` - Get history of applied global edits
- `POST /api/global-edits/{id}/undo` - Undo applied global edit (admin only)

### Users
- `GET /api/users/leaderboard` - Top 20 users by edits suggested/approved

### Admin
- `POST /api/admin/posts/fetch-new` - Fetch from Patreon via gallery-dl (requires session_id)
- `GET /api/admin/posts/pending` - List pending posts (page, limit)
- `PATCH /api/admin/posts/{id}` - Update pending post metadata
- `POST /api/admin/posts/{id}/publish` - Publish single post
- `POST /api/admin/posts/bulk-publish` - Publish multiple posts
- `DELETE /api/admin/posts/{id}` - Delete pending post
- `DELETE /api/admin/posts/bulk-delete` - Delete multiple posts
- `POST /api/admin/posts/{id}/skip` - Mark post as skipped

---

## Gallery-dl Usage

**Command for downloading posts with metadata:**
```bash
gallery-dl --cookies-from-browser chrome:"Profile 1" \
  --write-info-json \
  https://www.patreon.com/posts/[POST_ID]
```

**Output structure:**
```
gallery-dl/patreon/carza/
├── info.json                              # Single JSON with all metadata
├── [post_id]_[title]_01.png              # Image files
├── [post_id]_[title]_02.png
├── ...
└── [post_id]_[title]_34.zip              # Attachments
```

**info.json structure:**
```json
{
  "id": "129090487",
  "title": "Sailor pluto 481 pics",
  "published_at": "2025-01-20T18:17:36.000+00:00",
  "images": [
    {
      "file_name": "00000-2698488310.png",
      "download_url": "https://c10.patreonusercontent.com/...",
      "metadata": {"dimensions": {"h": 1296, "w": 896}}
    }
    // ... more images
  ],
  "attachments_media": [
    {"file_name": "00488-1697752924.zip", "download_url": "..."}
  ]
}
```

**Key points:**
- Use `--write-info-json` (not `--write-metadata`) for single JSON file
- Parse `info.json` to get list of images
- Iterate over `images` array (ignore `attachments_media`)
- Each image has `file_name`, `download_url`, and `dimensions`

---

## Feature Backlog

### Priority 5: CDN & Multiple Thumbnails - Remaining Phases

**Phase 4: Update Import Post Feature** ✅ COMPLETE (2-3 hours)
- [x] Updated `backend/app/services/patreon_service.py` to use new thumbnail naming
- [x] Use same parallel download logic from redownload script
- [x] Generate UUIDs for all images: `[postid]-t-[ordinal]-[uuid].ext`
- [x] Store all URLs in `thumbnail_urls` array
- [x] Updated `fetch_posts_with_gallery_dl` to use `--write-info-json`
- [x] Added `_download_single_image` and `_download_images_parallel` methods
- [x] Updated `extract_post_data_from_gallery_dl` to process info.json format
- [x] Parallel downloads with 10 workers, timing metrics included
- [ ] Test import flow with new post (USER TESTING)

**Phase 5: Frontend Updates** (🟡 Medium - 3-4 hours)
- [ ] Design decision: How to display multiple thumbnails
  - Option A: Grid view shows first thumbnail only
  - Option B: Grid view shows small gallery (first 4 thumbnails)
  - Option C: Grid view shows thumbnail count badge
- [ ] Update `PostCard` component based on design
- [ ] Create post detail/lightbox view (optional, can defer)
- [ ] Ensure responsive design
- [ ] Lazy loading for performance

**Phase 6: Cloudflare CDN Setup** (🟡 Medium - 2-3 hours)
- [ ] Sign up for Cloudflare account
- [ ] Add domain to Cloudflare
- [ ] Update DNS nameservers
- [ ] Configure Page Rules:
  - Cache everything under `/static/*` (1 month edge, 1 day browser)
  - Bypass cache for `/api/*`
- [ ] Test caching with `curl -I` (check `CF-Cache-Status` header)
- [ ] Monitor performance improvements

**Phase 7: Production Deployment** (🔴 Hard - 4-6 hours)
- [ ] Backup production database
- [ ] Run redownload script on production (all 2833 posts)
  - Estimated time: ~20-40 hours (parallelized)
  - Can run in batches or overnight
- [ ] Verify all thumbnails downloaded correctly
- [ ] Run SQL update script to update database
- [ ] Deploy frontend changes
- [ ] Verify all posts display correctly
- [ ] Clean up old thumbnail files (optional)
- [ ] Document new process

### Priority 6: Search Improvements & Case Insensitivity
- [ ] Ability to search for non-existent values (e.g., find posts with no characters, no series, no tags)
- [ ] Make sure everything is case insensitive (search, filters, autocomplete, matching)

### Priority 7: Image Viewer & Lightbox (🔴 Hard - 5-7 hours)
**CDN Integration**:
- Research CDN options (Cloudflare, CloudFront, Bunny CDN)
- Serve static assets (thumbnails, images) from CDN
- Configure caching headers and invalidation
- Update image URLs to use CDN domain
- **Benefits**: Faster load times, reduced server bandwidth
- **Complexity**: High - infrastructure setup

**Multiple Thumbnails Per Post**:
- Currently: 1 thumbnail per post (first image)
- Goal: Show all thumbnails in grid/carousel
- Backend: Already have `thumbnail_urls[]` array
- Frontend: Update PostCard to display multiple thumbnails
- Consider lazy loading for performance
- **Complexity**: Medium - UI component work

**Post Viewer / Lightbox**:
- Click thumbnail → open full-size image viewer
- Features: Navigation (prev/next), zoom, download
- Show all images from post in gallery
- Keyboard shortcuts (arrow keys, ESC)
- Mobile-friendly swipe gestures
- **Complexity**: High - complex UI component or library integration
- **Options**: Build custom or use library (react-image-lightbox, yet-another-react-lightbox)

---

## Legacy Features (Hidden)

### Backend (Implemented, Not Active)
- Users table with Patreon integration
- Submissions table with queue management
- Credit transactions (audit trail)
- Votes table
- Services: user, credit, submission, vote, session, config
- API routes: submissions, queue (paid/free), voting

### Frontend (Implemented, Hidden)
- Dashboard page
- Submit page
- Queue page
- Submission detail/edit pages
- Admin dashboard (legacy)

### Business Rules (Future)
- **Tiers**: Free (1 pending), $5 (1 credit/month), $10 (2/month), $20 (4/month)
- **Costs**: Base (1), Large set (+1), Double char (+1), Both (+2)
- **Queues**: Paid (FIFO), Free (votes then FIFO)
- **Voting**: Tier 1 only, 3 votes/month, cannot vote own

---

## Development Workflow

**CRITICAL RULES (applies to Goose AND all subagents):**

1. **Make changes** to code/files
2. **Notify user**: "Changes ready for testing"
3. **STOP and WAIT** - User tests locally (runs servers)
4. **User confirms**: "Looks good" or reports issues
5. **Only then commit** with descriptive message

**Testing Protocol**:
- **User runs servers**: `./start_server.sh` (backend), `npm run dev` (frontend)
- **User does all testing** - never assume code works
- **No auto-commits** without explicit user approval
- **No auto-testing** - let user verify functionality

**⚠️ GIT PUSH RULES - CRITICAL ⚠️**:
- **NEVER push to origin without explicit user approval**
- **ALWAYS verify with user what commits are about to be pushed**
- Before pushing:
  1. Show: `git log origin/master..HEAD --oneline`
  2. Ask: "These commits will be pushed. Proceed? (yes/no)"
  3. Wait for explicit "yes" confirmation
  4. Only then: `git push origin master`
- If user says no or anything other than "yes", DO NOT PUSH
- Accidental pushes can break production - always double check

**Subagent Usage (IMPORTANT - Use Frequently)**:
Goose should **actively use subagents** for well-defined tasks to save context and work in parallel. Use subagents when:

**When to use subagents**:
- ✅ Creating new files/components (well-defined scope)
- ✅ Implementing a specific feature with clear requirements
- ✅ Analyzing code structure or dependencies
- ✅ Refactoring a single component
- ✅ Writing tests for a specific module
- ✅ Fixing a specific bug with known location
- ✅ Adding a new API endpoint with clear spec
- ✅ Creating database migrations
- ✅ Multiple independent tasks that can run in parallel

**When NOT to use subagents**:
- ❌ Exploratory work (figuring out what needs to be done)
- ❌ Tasks requiring context from previous conversation
- ❌ Debugging unknown issues
- ❌ Making architectural decisions
- ❌ Tasks that depend on each other sequentially

**How to use subagents effectively**:
1. **Break down work** into independent, well-defined tasks
2. **Launch multiple subagents** in parallel when possible (one tool call with multiple subagents)
3. **Provide clear instructions** with all necessary context
4. **Review subagent output** before presenting to user
5. **Save context** by offloading routine tasks to subagents

**Example subagent tasks**:
- "Create a new React component for X with these props..."
- "Add a new API endpoint POST /api/Y that does Z..."
- "Analyze the file structure of directory X and summarize..."
- "Write a database migration to add column Y to table Z..."
- "Refactor component X to use hooks instead of class components..."

**Documentation**:
- **PROJECT_PLAN.md**: Forward-looking only (current status, next priorities, backlog)
  - Update "Current Status" summary
  - Update "Last Updated" timestamp
  - Move priorities around as they're completed
  - Do NOT add completed feature details here
- **PROJECT_LOG.md**: Historical record of completed work
  - Add detailed completion notes with dates
  - List all files changed, features implemented
  - Include technical details and lessons learned
  - This is the permanent achievement record
- **Commit messages**: Should reference both documents when appropriate

**Subagent Instructions**:
When using subagents, they must follow the same workflow:
- Make changes, notify completion
- Do NOT test or run servers
- Do NOT commit without user approval
- Return summary of changes for user review

**Subagent Testing & Verification**:
Individual subagents should:
- **Test their changes** before returning (syntax check, imports, basic logic)
- **Verify field names** match between related files (API calls use correct parameters)
- **Check for typos** in variable/field names
- **Ensure consistency** with existing code patterns
- **Report any uncertainties** or assumptions made

After using multiple subagents, Goose should:
1. **Launch a verification subagent** to check cross-file consistency:
   - Verify API endpoints match frontend calls (correct HTTP methods, parameters, response fields)
   - Verify database schema matches backend models (column names, types, constraints)
   - Verify backend schemas match API responses (field names align)
   - Check for common issues: typos, missing fields, type mismatches
2. **Review the verification report** before presenting to user
3. **Fix any issues found** before user testing

**Example verification checks**:
- Frontend calls `POST /api/X` with `{field_a, field_b}` → Backend expects those exact fields
- Backend model has `column_name` → Backend schema uses `column_name` (not `columnName`)
- API returns `{pattern, action, action_value}` → Frontend expects those exact fields
- Database has `VARCHAR(10)` → Backend model uses `String(10)` (matching length)

**Database Migrations**:
When adding new database columns/tables:
1. Create migration file in `backend/alembic/versions/`
2. Number it sequentially (e.g., `007_description.sql`)
3. **CRITICAL**: Migrations MUST be idempotent (safe to run multiple times)
   - Use `IF NOT EXISTS`, `IF EXISTS`, `DO $$ BEGIN ... EXCEPTION WHEN ... END $$`
   - Example: `ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;`
   - Example: `CREATE INDEX IF NOT EXISTS idx_name ON table(column);`
4. **CRITICAL**: When changing schema, update BOTH frontend AND backend:
   - Backend: Update model in `backend/app/models/`
   - Backend: Update schema in `backend/app/schemas/`
   - Backend: Update service layer if needed
   - Frontend: Update components that use the data
   - Frontend: Update API calls if field names changed
5. Document in commit message
6. Migrations run automatically via `deployment-scripts/deploy.sh`
7. Common errors:
   - `column X does not exist` → Migration not run yet
   - `relation X does not exist` → Earlier migrations missing
   - Schema mismatch between frontend/backend → Forgot to update one side

**Deployment**:
To deploy to production:
1. Commit and push all changes to `origin/master`
2. SSH to production server: `ssh deploy@YOUR_SERVER_IP`
3. Run deployment script: `cd ~/vamasubmissions && bash deployment-scripts/deploy.sh`

The deployment script automatically:
- Backs up database
- Pulls latest code
- Runs all migrations (idempotent, safe to re-run)
- Updates dependencies (Python + Node)
- Rebuilds frontend
- Restarts backend service
- Verifies deployment

See `deployment-scripts/README.md` for details.

---

## UI/UX Design Guidelines

**Accessibility & Contrast**:
- **NEVER use white text on white background** or light text on light background
- Always specify explicit text colors: `text-gray-900` for dark text on light backgrounds
- Always specify placeholder colors: `placeholder-gray-400` or similar
- Test input fields in all states (empty, focused, filled, autofilled)
- Ensure sufficient contrast ratios (WCAG AA minimum: 4.5:1 for normal text)

---

## Session Continuation

Say: **"Read PROJECT_PLAN.md and continue where we left off"**

Goose will review status, check completed items, identify next priority, and continue implementation.

---

*See README.md for setup instructions. See PROJECT_LOG.md for detailed development history.*
