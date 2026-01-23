# Project Plan - VAMA Community Tracker

**Last Updated**: 2026-01-23 14:09

## Current Status

Phase 1 + Post Import System + SearchPage Refactoring **COMPLETE ✅**

Backend: 25+ API endpoints, 2691+ posts imported, full business logic implemented. Frontend: SearchPage (refactored into 5 components), CommunityRequestsPage, ReviewEditsPage, ImportPostsPage (admin), AboutPage. All features use non-blocking banner notifications. Mock auth available for development. See PROJECT_LOG.md for detailed history.

**Next Priority**: Browse Tab feature (character/series/tags aggregation) OR Data normalization & security (input validation, rate limiting).

---

## Business Rules

### Access Control
- Must be subscribed to VAMA's Patreon
- Tier detection preserved for future use
- All Phase 1 features available to all subscribers

### Posts
- Source: vama_posts_initial.csv + Patreon imports
- Fields: post_id, timestamp, url, title, characters[], series[], tags[], image_urls[]
- Searchable: title, characters, series, tags (full-text + filters)
- Status: 'pending', 'published', 'skipped'

### Community Requests
- Unofficial queue tracking (not VAMA's official queue)
- Fields: character_name, series, timestamp (when requested), description, is_private, fulfilled
- Display: Sorted by timestamp (oldest first), private requests obscured
- Actions: Users mark own fulfilled, admins can delete any

### Community Edits
- Editable: characters[], series[], tags[] on posts
- Actions: ADD, DELETE (typo fixes = delete + add)
- Workflow: Any subscriber suggests → different subscriber approves → immediately applied
- Audit trail: All edits logged with suggester, approver, timestamp
- Admin can undo edits

---

## Data Models

### Posts
```sql
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    post_id VARCHAR(255) UNIQUE NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    characters TEXT[] DEFAULT '{}',
    series TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    image_urls TEXT[] DEFAULT '{}',
    thumbnail_urls TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'published',
    raw_patreon_json JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX posts_search_idx ON posts USING GIN (to_tsvector('english', ...));
CREATE INDEX idx_posts_status ON posts(status);
```

### Community Requests
```sql
CREATE TABLE community_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    character_name VARCHAR(255) NOT NULL,
    series VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    fulfilled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_requests_timestamp ON community_requests(timestamp);
CREATE INDEX idx_requests_fulfilled ON community_requests(fulfilled);
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

### Admin Settings
```sql
CREATE TABLE admin_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    patreon_access_token TEXT,
    patreon_refresh_token TEXT,
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### Authentication
- `GET /api/auth/login` - Redirect to Patreon OAuth
- `GET /api/auth/callback` - Handle OAuth callback, return JWT
- `POST /api/auth/logout` - Invalidate session
- `GET /api/auth/me` - Get current user info

### Posts
- `GET /api/posts/search` - Search posts (q, page, limit, character, series, tag, title, order)
- `GET /api/posts/{id}` - Get post details
- `GET /api/posts/autocomplete/characters` - Character autocomplete
- `GET /api/posts/autocomplete/series` - Series autocomplete
- `GET /api/posts/autocomplete/tags` - Tag autocomplete
- `GET /api/posts/autocomplete/characters-with-series` - Character autocomplete with series info

### Community Requests
- `POST /api/requests/` - Create request
- `GET /api/requests/` - List all requests (page, limit)
- `GET /api/requests/my` - List user's own requests
- `PATCH /api/requests/{id}/fulfill` - Mark own request fulfilled
- `DELETE /api/requests/{id}` - Delete request (own or admin)

### Post Edits
- `POST /api/edits/suggest` - Suggest edit (post_id, field_name, action, value)
- `GET /api/edits/pending` - List pending edits
- `POST /api/edits/{id}/approve` - Approve edit (cannot approve own)
- `POST /api/edits/{id}/reject` - Reject edit
- `GET /api/edits/history` - Get edit history (optional post_id filter)
- `POST /api/edits/{id}/undo` - Undo edit (admin only)

### Users
- `GET /api/users/leaderboard` - Top 20 users by edits suggested/approved

### Admin
- `POST /api/admin/fetch-new-posts` - Fetch from Patreon via gallery-dl
- `GET /api/admin/pending-posts` - List pending posts (page, limit)
- `PATCH /api/admin/posts/{id}` - Update pending post metadata
- `POST /api/admin/posts/{id}/publish` - Publish single post
- `POST /api/admin/posts/bulk-publish` - Publish multiple posts
- `DELETE /api/admin/posts/{id}` - Delete pending post
- `POST /api/admin/posts/bulk-delete` - Delete multiple posts
- `POST /api/admin/posts/{id}/skip` - Mark post as skipped

---

## Feature Backlog

### Priority 1: Browse Tab (🔴 Hard - 6 hours)
- Tabbed interface (Search / Browse)
- Browse characters, series, tags with counts
- Aggregation endpoint: `GET /api/posts/browse/{type}` returns `[{name, count}]`
- Click item → filter posts by that value
- Reuse SearchResults component
- **Implementation**: Backend SQL aggregation (COUNT/GROUP BY), frontend tab state management

### Priority 2: Data Normalization & Security (🟡 Medium - 2-3 hours)
- **Input validation**: Trim whitespace, normalize unicode, prevent empty strings
- **Backend**: Create `utils/validation.py` with `normalize_text()` and `normalize_array_field()`
- **Frontend**: Create `utils/validation.js` with matching functions
- **Apply to**: All text inputs (characters, series, tags, descriptions)
- **Security**: Add rate limiting (slowapi), enhance Pydantic validators with Field constraints
- **Testing**: Whitespace, unicode, duplicates, case-insensitive matching

### Priority 3: Global Edit Suggestions (🔴 Hard - 8-10 hours)
- Bulk rename across all posts (e.g., "Naruto Uzamaki" → "Naruto Uzumaki" on 50 posts)
- New table: `global_edit_suggestions` with status workflow
- Preview affected posts before approval
- Backend: `array_replace()` for bulk updates
- Frontend: New GlobalEditsPage with tabs (Suggest / Pending / History)
- **Complexity**: Atomic bulk operations, preview logic, undo functionality

### Priority 4: Modal → Expandable Section (🟡 Medium - 2-3 hours)
- Convert EditModal to inline expandable section under each post
- Better UX: Edit multiple posts without opening/closing modals
- Click "Suggest Edit" → section expands below post card
- Click away or "Cancel" → section collapses
- Reuse existing EditModal logic, just change presentation
- **Files**: `PostCard.jsx`, `EditModal.jsx` → `EditSection.jsx`

### Quick Wins (Completed)
- ✅ Disclaimer banner on requests page
- ✅ Sort direction toggle (newest/oldest)
- ✅ Prevent duplicate edit suggestions
- ✅ Show pending edits inline in search results
- ✅ About page with leaderboards
- ✅ Latest post date on import page
- ✅ SearchPage component extraction (1066 → 239 lines)

### Future Enhancements (Not in Scope)
- Posts without tags filter
- Email notifications
- Discord integration
- Rush queue (skip positions for credits)
- Request templates
- Batch submissions
- Gift credits
- Public gallery
- Favorites system

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

**Documentation**:
- Update PROJECT_PLAN.md as part of commits (not separate)
- Mark completed features with ✅, update timestamps
- Keep PROJECT_PLAN.md current with latest status

**Subagent Instructions**:
When using subagents, they must follow the same workflow:
- Make changes, notify completion
- Do NOT test or run servers
- Do NOT commit without user approval
- Return summary of changes for user review

**Database Migrations**:
When adding new database columns/tables:
1. Create migration file in `backend/alembic/versions/`
2. Number it sequentially (e.g., `007_description.sql`)
3. Document in commit message
4. User must run migration: `psql vamasubmissions < backend/alembic/versions/XXX_file.sql`
5. Common errors:
   - `column X does not exist` → Migration not run yet
   - `relation X does not exist` → Earlier migrations missing

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
