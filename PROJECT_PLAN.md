# Project Plan - VAMA Community Tracker

Development plan and status for the VAMA Community Post Search & Request Tracker.

## Current Status: Phase 1 COMPLETE ✅ + Post Import System COMPLETE ✅ + Quick Wins COMPLETE ✅

**Last Updated**: 2026-01-22 23:04

### ✅ What's Working
- ✅ **Backend API** - 20+ endpoints fully functional (including admin import endpoints)
- ✅ **Database** - 2,691+ posts imported and indexed
- ✅ **Models, schemas, services** - All Phase 1 + Post Import business logic complete
- ✅ **Patreon OAuth 2.0** - Real authentication working!
- ✅ **Search Page** - Full-featured with autocomplete, filters, edit suggestions, title search
- ✅ **Community Requests Page** - Form, queue, my requests, delete
- ✅ **Review Edits Page** - Pending/history tabs, approve/reject/undo
- ✅ **Import Posts Page** - Full admin workflow for importing and tagging Patreon posts
- ✅ **Navigation** - Header updated with admin-only Import Posts link
- ✅ **Routing** - App.jsx configured, legacy routes hidden
- ✅ **Mock Login** - Development mode available
- ✅ **UI/UX** - Zero disruptive popups! All feedback via non-blocking banners

### 🎉 Recent Achievements (2026-01-22)

**Morning Session** (Post Import System):
- ✅ **Post Import System** - Complete workflow from Patreon → pending → published
- ✅ **gallery-dl Integration** - Automated post fetching with metadata
- ✅ **Skip Feature** - Mark non-character posts (announcements) as skipped
- ✅ **Title Search** - Dedicated search input for finding posts by title
- ✅ **UI Overhaul** - Replaced ALL alert/confirm/prompt with banner notifications
- ✅ **Character-Series Autocomplete** - Shows series alongside character names
- ✅ **Auto-add Series** - Automatically adds character's most common series
- ✅ **Bulk Operations** - Save/publish/delete multiple posts at once
- ✅ **Unsaved Changes Indicator** - Visual feedback for pending changes
- ✅ **Security Fix** - Removed exposed credentials from Git history

**Evening Session** (Quick Wins - 1 hour 15 min):
- ✅ **Disclaimer Banner** - Added to Community Requests page explaining unofficial nature
- ✅ **Sort Direction Toggle** - Date sorting dropdown on SearchPage (Newest/Oldest First)
- ✅ **Prevent Duplicate Edits** - Backend validation prevents duplicate pending suggestions
- ✅ **3 Commits Pushed** - All quick wins committed and deployed to master

### 🐛 Known Issues
- None! All features tested and working

### 📦 Recent Cleanup (2026-01-21)
- Removed 50 MB of test/debug files (HAR files, old test servers, outdated docs)
- Preserved `all-post-api/` (332 MB) and `test_thumbnails/` (12 MB)
- Mock login still works after cleanup

---

## Business Rules (Phase 1: Community Features)

### Access Control
- **Requirement**: Must be subscribed to VAMA's Patreon
- **Tier Detection**: Preserved for future use (tiers 1-5)
- **All Features**: Available to all subscribers regardless of tier

### Posts (Existing VAMA Content)
- **Data Source**: vama_posts_initial.csv (~3000 posts)
- **Post Fields**:
  - `post_id` (unique identifier)
  - `timestamp` (post date)
  - `url` (Patreon post URL)
  - `title` (post title)
  - `characters` (array of character names)
  - `series` (array of series names)
  - `tags` (array of tags)
  - `image_urls` (array of image URLs)
- **Searchable**: title, characters, series, tags
- **Display**: List view with thumbnail rows, paginated

### Community Requests (Unofficial Queue)
- **Purpose**: Community tracking of requests (not official queue)
- **Request Fields**:
  - `character_name` (required)
  - `series` (required)
  - `timestamp` (required, user-specified when request was made)
  - `description` (optional)
  - `is_private` (optional, default false)
  - `user_id` (automatic)
  - `fulfilled` (boolean, default false)
- **Queue Display**:
  - All requests shown, sorted by timestamp (oldest first)
  - Private requests obscured (show "[Private Request]" placeholder)
  - User's own requests highlighted with queue position number
- **Actions**:
  - Users can mark own requests as fulfilled
  - Admins can remove any request
- **Disclaimer**: Banner stating this is unofficial, not everyone uses it

### Community Edits (Collaborative Metadata)
- **Editable Fields**: characters, series, tags (on posts)
- **Edit Types**:
  - **ADD**: Add new value to array
  - **DELETE**: Remove existing value from array
  - (Typo fixes = delete old + add corrected)
- **Workflow**:
  1. Any subscriber can suggest edit
  2. Any different subscriber can approve
  3. One approval = edit applied immediately
  4. All edits logged in audit trail
- **Audit Trail**:
  - Track: suggester, approver, timestamp, field, action, value
  - Admin can review/undo if needed
- **Review Page**: Show all pending edits awaiting approval

---

## Data Models (New Schema)

### Posts Table
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX posts_search_idx ON posts USING GIN (
    to_tsvector('english', 
        COALESCE(title, '') || ' ' || 
        COALESCE(array_to_string(characters, ' '), '') || ' ' ||
        COALESCE(array_to_string(series, ' '), '') || ' ' ||
        COALESCE(array_to_string(tags, ' '), '')
    )
);
```

### Community Requests Table
```sql
CREATE TABLE community_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    character_name VARCHAR(255) NOT NULL,
    series VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,  -- When user made the request
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    fulfilled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_requests_timestamp ON community_requests(timestamp);
CREATE INDEX idx_requests_user ON community_requests(user_id);
CREATE INDEX idx_requests_fulfilled ON community_requests(fulfilled);
```

### Post Edits Table
```sql
CREATE TABLE post_edits (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    suggester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(50) NOT NULL,  -- 'characters', 'series', 'tags'
    action VARCHAR(10) NOT NULL,      -- 'ADD', 'DELETE'
    value TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP
);

CREATE INDEX idx_edits_status ON post_edits(status);
CREATE INDEX idx_edits_post ON post_edits(post_id);
```

### Edit History Table (Audit Log)
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
CREATE INDEX idx_history_applied ON edit_history(applied_at);
```

---

## Legacy Business Rules (Hidden, For Future Use)

### User Tiers & Credits
- **Tier 1 (Free)**: 1 pending request at a time, no credits, no carryover
- **Tier 2 ($5)**: 1 credit/month, 2 credits max, 2-month expiry
- **Tier 3 ($10)**: 2 credits/month, 4 credits max, 2-month expiry
- **Tier 4 ($20)**: 4 credits/month, 8 credits max, 2-month expiry

### Submission Costs
- **Base submission**: 1 credit
- **Large image set**: +1 credit (total 2)
- **Double character**: +1 credit (total 2)
- **Both modifiers**: +2 credits (total 3)

### Queue System
- **Paid Queue (Tiers 2/3/4)**: Strict FIFO ordering by submission time
- **Free Queue (Tier 1)**: Ordered by vote count (desc), then submission time
- All tiers 2/3/4 have equal priority within paid queue

### Voting System (Tier 1 Only)
- Each tier 1 user gets 3 votes per month (configurable)
- Can vote on other tier 1 pending submissions
- Cannot vote on own submissions
- Can remove votes
- Votes reset monthly

### Submission Rules
- **Tier 1**: Can only have 1 pending submission at a time
- **Tiers 2/3/4**: Can have multiple pending submissions
- Users can edit pending submissions (may cost additional credits)
- Users can cancel submissions for full credit refund
- Max 20 images per submission, 10MB per image

### Visibility
- Submissions can be marked public or private
- Users see:
  - All their own submissions (public + private)
  - Other users' public submissions only
  - Queue size and their position
- Admins/Creator see everything

---

## Project Status (Phase 1: Community Features)

### ✅ COMPLETED: Backend (FastAPI)

**Status**: All backend functionality implemented and tested.

#### Database Schema
- ✅ Created migration `002_add_phase1_tables.sql`:
  - ✅ `posts` table with GIN indexes for array fields
  - ✅ `community_requests` table
  - ✅ `post_edits` table with constraints
  - ✅ `edit_history` table (audit log)
- ✅ Import script `import_posts.py` created
- ✅ Successfully imported 2691 posts from vama_posts_initial.csv + all-post-api/ JSON files
- ✅ Kept existing schema (users, submissions, etc.) for future use

#### New Models & Schemas
- ✅ `models/post.py` - Post model with array fields (characters, series, tags, image_urls, thumbnail_urls)
- ✅ `models/community_request.py` - Community request model with privacy support
- ✅ `models/post_edit.py` - Edit suggestion model with approval workflow
- ✅ `models/edit_history.py` - Audit log model
- ✅ Pydantic schemas for all new models (20+ schema classes)

#### New API Routes
- ✅ `api/posts.py` - 5 endpoints (search, get details, autocomplete x3)
- ✅ `api/community_requests.py` - 6 endpoints (CRUD, fulfill, my requests)
- ✅ `api/edits.py` - 6 endpoints (suggest, approve, reject, pending, history, undo)
- ✅ All routes registered in `main.py`

#### New Services
- ✅ `services/post_service.py` - Search logic with filters, autocomplete
- ✅ `services/request_service.py` - Queue management, privacy handling, positions
- ✅ `services/edit_service.py` - Edit workflow, approval logic, apply edits, undo

#### Data Import
- ✅ CSV import script for vama_posts_initial.csv
- ✅ Validation and error handling
- ✅ Handle array fields (characters, series, tags, image_urls, thumbnail_urls)
- ✅ Auto-generate tags based on rules (clone, yuri, lesbian)

### ✅ COMPLETED: Post Import System (2026-01-22)

**Status**: Full admin workflow for importing Patreon posts implemented and tested.

#### Backend Features
- ✅ `services/patreon_service.py` - gallery-dl integration for Patreon post fetching
  - ✅ Auto-detect Chrome profile for cookies
  - ✅ Metadata-only download (no full images)
  - ✅ Incremental import (only fetch posts since last import)
  - ✅ Duplicate detection and handling
  - ✅ Random placeholder thumbnail selection
- ✅ `models/admin_settings.py` - Store Patreon tokens per admin user
- ✅ `models/post.py` - Added `status` field ('pending', 'published', 'skipped')
- ✅ `models/post.py` - Added `raw_patreon_json` field (JSONB) for full post data
- ✅ `schemas/post.py` - PostStatus enum with 'skipped' status
- ✅ `api/admin.py` - 8 new endpoints:
  - ✅ `POST /fetch-new-posts` - Fetch from Patreon via gallery-dl
  - ✅ `GET /pending-posts` - List pending posts with pagination
  - ✅ `PATCH /posts/{id}` - Update pending post (characters, series, tags)
  - ✅ `POST /posts/{id}/publish` - Publish single post
  - ✅ `POST /posts/bulk-publish` - Publish multiple posts
  - ✅ `DELETE /posts/{id}` - Delete pending post
  - ✅ `POST /posts/bulk-delete` - Delete multiple posts
  - ✅ `POST /posts/{id}/skip` - Mark post as skipped (for non-character posts)
- ✅ `api/posts.py` - Added `/autocomplete/characters-with-series` endpoint
- ✅ `services/post_service.py` - Added `get_character_series_map()` function

#### Frontend Features
- ✅ **ImportPostsPage** (`src/pages/admin/ImportPostsPage.jsx`)
  - ✅ "Import New Posts" button with loading state
  - ✅ Pending posts grid with thumbnails
  - ✅ Character/series/tags editing with autocomplete
  - ✅ Character autocomplete shows most common series
  - ✅ Auto-add series when selecting character
  - ✅ Add non-existent characters/series (Enter + Add button)
  - ✅ Unsaved changes indicator (yellow badge)
  - ✅ Click-away dismissal for autocomplete dropdowns
  - ✅ Individual post actions: Save, Publish, Delete, Skip
  - ✅ Bulk actions: Save Selected, Publish Selected, Delete Selected
  - ✅ Selection checkboxes with "Select All" toggle
  - ✅ Post count display: "X of Y pending posts"
  - ✅ Remove posts from list without page reload
  - ✅ Card-level success/error banners
  - ✅ Non-blocking banner notifications (no popups!)
- ✅ Admin-only route protection in `ProtectedRoute.jsx`
- ✅ Admin-only "Import Posts" link in `Header.jsx`

#### gallery-dl Configuration
- ✅ Metadata-only download (`--no-download`)
- ✅ JSON metadata output (`--write-metadata`)
- ✅ Auto-detect Chrome profile (`--cookies-from-browser chrome`)
- ✅ Date filtering (`--filter "date >= datetime(...)"`)
- ✅ Patreon-specific options for post extraction

#### Database Migrations
- ✅ `003_add_post_status_and_raw_json.sql` - Added status and raw_patreon_json columns
- ✅ `004_create_admin_settings.sql` - Created admin_settings table
- ✅ `005_add_skipped_status.sql` - Updated CHECK constraint to include 'skipped'

### ✅ COMPLETED: Frontend (React)

**Status**: All Phase 1 + Post Import frontend features implemented (2026-01-22)

#### Frontend Restructure
- ✅ Legacy pages hidden in App.jsx (Dashboard, Submit, Queue, Admin)
- ✅ Authentication flow preserved (Login, Callback, ProtectedRoute)
- ✅ Header navigation updated (Search, Requests, Review Edits, Logout)
- ✅ Routing configured in App.jsx with smart redirect to /search

#### Phase 1 Pages - COMPLETE
- ✅ **SearchPage** (`src/pages/SearchPage.jsx`)
  - ✅ Autocomplete for characters, series, tags with "No results found" feedback
  - ✅ Dedicated title search input field
  - ✅ Filter chips with add/remove
  - ✅ Results list with thumbnails (single column layout)
  - ✅ Pagination controls
  - ✅ Link to Patreon post
  - ✅ Edit suggestion modal with all three fields (characters, series, tags)
  - ✅ Inline add/remove with autocomplete in modal
  - ✅ Non-blocking banner notifications (no popups!)
  
- ✅ **CommunityRequestsPage** (`src/pages/CommunityRequestsPage.jsx`)
  - ✅ Collapsible request submission form
  - ✅ Autocomplete for characters and series (comma-separated)
  - ✅ Date picker for requested timestamp
  - ✅ Description field (optional)
  - ✅ "My Requests" section with status badges
  - ✅ Community queue display
  - ✅ Delete functionality with confirmation modal
  - ✅ Non-blocking banner notifications (no popups!)
  
- ✅ **ReviewEditsPage** (`src/pages/ReviewEditsPage.jsx`)
  - ✅ Tabbed interface (Pending / History)
  - ✅ Pending edits list with thumbnails
  - ✅ Action badges (ADD/DELETE) with color coding
  - ✅ Approve/Reject with confirmation modals
  - ✅ Edit history view
  - ✅ Undo functionality (admin) with confirmation modal
  - ✅ Formatted display with post titles
  - ✅ Non-blocking banner notifications (no popups!)

#### Components - Built Inline
- ✅ Filter chips (inline in SearchPage)
- ✅ Edit modal (inline in SearchPage)
- ✅ Request form (inline in CommunityRequestsPage)
- ✅ Edit review cards (inline in ReviewEditsPage)

#### UI/UX Features
- ✅ Loading states with spinners
- ✅ Error handling with styled error messages
- ✅ Success feedback messages
- ✅ Confirmation dialogs (browser confirm)
- ✅ Responsive layout (Tailwind CSS)
- ✅ Color-coded badges and status indicators
- ✅ Hover effects and transitions

### TODO: Testing & Deployment

#### Backend Testing
- [ ] Test post search (full-text, pagination)
- [ ] Test community request CRUD
- [ ] Test edit workflow (suggest, approve, apply)
- [ ] Test audit logging
- [ ] Test permissions (subscriber vs admin)

#### Frontend Testing
- [ ] Test search functionality
- [ ] Test request queue
- [ ] Test edit suggestions and approval
- [ ] Mobile responsiveness testing

#### Deployment
- [ ] Set up PostgreSQL on Linode
- [ ] Import vama_posts_initial.csv to production
- [ ] Configure environment variables
- [ ] Deploy backend with systemd service
- [ ] Build and deploy frontend (static files)
- [ ] Configure nginx reverse proxy
- [ ] Set up SSL with Let's Encrypt
- [ ] Configure database backups
- [ ] Set up monitoring/logging

---

## Legacy Status (Hidden Features)

### COMPLETED: Legacy Backend (FastAPI)

All legacy functionality is implemented but hidden in Phase 1.

#### Database Schema (`schema.sql`)
- ✅ Users table with Patreon integration
- ✅ Submissions table with queue management
- ✅ Submission images table
- ✅ Credit transactions table (audit trail)
- ✅ Votes table
- ✅ User vote allowance table
- ✅ Sessions table (JWT management)
- ✅ System config table
- ✅ Views for queues and stats

#### Core Services (`backend/app/services/`)
- ✅ `user_service.py` - User management, authentication
- ✅ `credit_service.py` - Credit allocation, transactions
- ✅ `submission_service.py` - Submission CRUD, queue management
- ✅ `vote_service.py` - Voting logic
- ✅ `session_service.py` - Session management
- ✅ `config_service.py` - System configuration

#### API Routes (`backend/app/api/`)
- ✅ `auth.py` - Patreon OAuth flow, login/logout
- ✅ `users.py` - User info, credit history
- ✅ `submissions.py` - Create/edit/cancel submissions, image upload, search
- ✅ `queue.py` - View queues, voting
- ✅ `admin.py` - Admin dashboard, complete submissions, user management

### COMPLETED: Legacy Frontend (React)

Frontend exists but needs restructuring for Phase 1.

#### Existing Pages (TO BE HIDDEN)
- ✅ Login page (KEEP)
- ✅ OAuth callback (KEEP)
- ✅ Dashboard page (HIDE)
- ✅ Submit page (HIDE)
- ✅ Queue page (HIDE)
- ✅ Search page (MODIFY for Phase 1)
- ✅ Submission detail page (HIDE)
- ✅ Submission edit page (HIDE)
- ✅ Admin dashboard (HIDE)

#### Existing Infrastructure (KEEP)
- ✅ React + Vite setup
- ✅ Tailwind CSS
- ✅ Mock authentication system
- ✅ API client (axios)
- ✅ Authentication context
- ✅ Protected routes
- ✅ Layout components

---

## File Structure

```
vamasubmissions/
├── PROJECT_PLAN.md          # This file
├── README.md                # Setup instructions
├── schema.sql               # Database schema
│
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # FastAPI app entry point
│   │   ├── api/            # API route handlers
│   │   │   ├── auth.py     # Patreon OAuth, login/logout
│   │   │   ├── users.py    # User endpoints
│   │   │   ├── submissions.py  # Submission CRUD
│   │   │   ├── queue.py    # Queue views, voting
│   │   │   └── admin.py    # Admin endpoints
│   │   ├── core/           # Core utilities
│   │   │   ├── config.py   # Settings management
│   │   │   ├── database.py # DB connection
│   │   │   └── security.py # JWT, hashing
│   │   ├── models/         # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── submission.py
│   │   │   ├── credit.py
│   │   │   ├── vote.py
│   │   │   ├── session.py
│   │   │   └── system_config.py
│   │   ├── schemas/        # Pydantic schemas
│   │   │   ├── user.py
│   │   │   ├── submission.py
│   │   │   ├── auth.py
│   │   │   ├── queue.py
│   │   │   └── vote.py
│   │   └── services/       # Business logic
│   │       ├── user_service.py
│   │       ├── credit_service.py
│   │       ├── submission_service.py
│   │       ├── vote_service.py
│   │       ├── session_service.py
│   │       └── config_service.py
│   ├── alembic/            # DB migrations (optional)
│   ├── tests/              # Backend tests
│   ├── uploads/            # Image storage
│   ├── requirements.txt    # Python dependencies
│   └── env.example         # Environment template
│
└── frontend/               # React application (TO BE CREATED)
    ├── src/
    │   ├── components/     # Reusable components
    │   ├── pages/          # Page components
    │   ├── services/       # API client
    │   ├── hooks/          # Custom React hooks
    │   ├── contexts/       # React contexts
    │   ├── App.jsx         # Main app component
    │   └── main.jsx        # Entry point
    ├── public/             # Static assets
    ├── package.json
    └── vite.config.js
```

---

## API Endpoints Reference (Phase 1)

### Authentication (`/api/auth`)
- `GET /api/auth/login` - Redirect to Patreon OAuth
- `GET /api/auth/callback?code=...` - Handle OAuth callback, returns JWT
- `POST /api/auth/logout` - Logout (invalidate session)
- `GET /api/auth/me` - Get current user info (includes subscription status)

### Posts (`/api/posts`) - NEW
- `GET /api/posts/search?q=query&page=1&limit=20` - Search posts (full-text)
  - Query params: q (search term), page, limit, character, series, tag
  - Returns: posts array, total count, page info
- `GET /api/posts/{id}` - Get post details
- `GET /api/posts/autocomplete/characters?q=query` - Character autocomplete
- `GET /api/posts/autocomplete/series?q=query` - Series autocomplete
- `GET /api/posts/autocomplete/tags?q=query` - Tag autocomplete

### Community Requests (`/api/requests`) - NEW
- `POST /api/requests/` - Create request
  - Body: {character_name, series, timestamp, description?, is_private?}
- `GET /api/requests/?page=1&limit=50` - List all requests (sorted by timestamp)
  - Returns: requests array (private ones obscured), user's positions
- `GET /api/requests/my` - List user's own requests
- `PATCH /api/requests/{id}/fulfill` - Mark own request as fulfilled
- `DELETE /api/requests/{id}` - Delete request (own or admin)

### Post Edits (`/api/edits`) - NEW
- `POST /api/edits/suggest` - Suggest edit
  - Body: {post_id, field_name, action, value}
  - field_name: 'characters', 'series', 'tags'
  - action: 'ADD', 'DELETE'
- `GET /api/edits/pending` - List pending edits
- `POST /api/edits/{id}/approve` - Approve edit (applies immediately)
  - Cannot approve own suggestions
- `GET /api/edits/history?post_id=...` - Get edit history (audit log)
  - Optional: filter by post_id
- `POST /api/edits/{id}/undo` - Undo edit (admin only)

### Admin (`/api/admin`) - UPDATED
- `GET /api/admin/users` - List all users with stats
- `PATCH /api/admin/users/{id}/role` - Update user role
- `DELETE /api/admin/requests/{id}` - Remove any request
- `GET /api/admin/edits/history` - Full edit history with filters

### Admin - Post Import (`/api/admin`) - NEW (2026-01-22)
- `POST /api/admin/fetch-new-posts` - Fetch new posts from Patreon via gallery-dl
  - Uses admin's stored Patreon tokens
  - Auto-detects Chrome profile for cookies
  - Only fetches posts since last import
  - Returns: count of new posts imported
- `GET /api/admin/pending-posts?page=1&limit=50` - List pending posts
  - Returns: posts with status='pending', pagination info
- `PATCH /api/admin/posts/{id}` - Update pending post metadata
  - Body: {characters?, series?, tags?}
- `POST /api/admin/posts/{id}/publish` - Publish single post
  - Changes status from 'pending' to 'published'
  - Makes post searchable
- `POST /api/admin/posts/bulk-publish` - Publish multiple posts
  - Body: {post_ids: [1, 2, 3]}
- `DELETE /api/admin/posts/{id}` - Delete pending post
- `POST /api/admin/posts/bulk-delete` - Delete multiple posts
  - Body: {post_ids: [1, 2, 3]}
- `POST /api/admin/posts/{id}/skip` - Mark post as skipped
  - For non-character posts (announcements, polls, etc.)
  - Changes status to 'skipped'
  - Post won't appear in search results
  - Post won't be re-imported (post_id exists in DB)

---

## Legacy API Endpoints (Hidden)

### Users (`/api/users`)
- `GET /api/users/me` - Get current user details
- `GET /api/users/me/credits/history?limit=50` - Get credit transaction history

### Submissions (`/api/submissions`)
- `POST /api/submissions/` - Create submission (multipart form)
- `POST /api/submissions/{id}/images` - Upload images (multipart, list of files)
- `GET /api/submissions/` - List my submissions (query param: status)
- `GET /api/submissions/{id}` - Get submission details
- `PATCH /api/submissions/{id}` - Update submission (JSON body)
- `POST /api/submissions/{id}/cancel` - Cancel submission (optional reason in body)
- `GET /api/submissions/search/?q=query` - Search completed submissions
- `GET /api/submissions/autocomplete/series?q=query` - Get series suggestions

### Queue (`/api/queue`)
- `GET /api/queue/paid` - Get paid queue info
- `GET /api/queue/free` - Get free queue info
- `POST /api/queue/vote` - Vote for submission (body: {submission_id})
- `DELETE /api/queue/vote/{submission_id}` - Remove vote
- `GET /api/queue/vote/allowance` - Get vote allowance for current month
- `GET /api/queue/vote/my-votes` - Get list of submission IDs voted for

### Admin (Legacy) (`/api/admin`)
- `GET /api/admin/submissions?status=...&queue_type=...` - List all submissions
- `GET /api/admin/submissions/{id}` - Get submission (includes creator notes)
- `POST /api/admin/{id}/complete` - Mark complete (body: {patreon_post_link, creator_notes})
- `PATCH /api/admin/{id}/notes` - Update creator notes (body: notes string)
- `POST /api/admin/{id}/start` - Mark as in progress
- `GET /api/admin/stats` - Get queue statistics
- `POST /api/admin/users/{id}/credits` - Adjust credits (body: {amount, reason})

---

## Environment Setup

### Backend Environment Variables (`.env`)

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost/vamasubmissions

# Patreon OAuth
PATREON_CLIENT_ID=your_patreon_client_id
PATREON_CLIENT_SECRET=your_patreon_client_secret
PATREON_REDIRECT_URI=http://localhost:8000/api/auth/callback
PATREON_CREATOR_ID=your_patreon_creator_id

# Security
SECRET_KEY=generate-with-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=30

# File uploads
UPLOAD_DIR=./uploads
MAX_IMAGE_SIZE_MB=10
MAX_IMAGES_PER_SUBMISSION=20

# Application
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173

# Admin (your Patreon user ID)
ADMIN_PATREON_ID=your_patreon_id
```

### Frontend Environment Variables (`.env`)

```bash
VITE_API_URL=http://localhost:8000
```

---

## Quick Start (Local Development)

### Start Development (2 Commands)

```bash
# Terminal 1: Backend
cd backend && source venv/bin/activate && ./start_server.sh

# Terminal 2: Frontend  
cd frontend && npm run dev
```

Then open: http://localhost:5173

**API Docs**: http://localhost:8000/docs

### First Time Setup

**Database:**
```bash
createdb vamasubmissions
psql vamasubmissions < schema.sql
psql vamasubmissions < backend/alembic/versions/002_add_phase1_tables.sql

# Import posts (requires vama_posts_initial.csv and all-post-api/)
cd backend && source venv/bin/activate && cd ..
DATABASE_URL='postgresql://yourusername@localhost/vamasubmissions' python3 backend/import_posts.py
```

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your config
```

**Frontend:**
```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
echo "VITE_USE_MOCK_AUTH=true" >> .env
```

### Mock Authentication

With `VITE_USE_MOCK_AUTH=true`, test as different users:
- **tier1** - Free tier
- **tier2** - $5 tier  
- **tier3** - $10 tier
- **tier4** - $20 tier
- **admin** - Admin access

### Useful Commands

```bash
# Check database
psql vamasubmissions -c "SELECT COUNT(*) FROM posts;"  # Should show 2691

# Reset database
dropdb vamasubmissions && createdb vamasubmissions
psql vamasubmissions < schema.sql
psql vamasubmissions < backend/alembic/versions/002_add_phase1_tables.sql

# Reimport posts
DATABASE_URL='postgresql://yourusername@localhost/vamasubmissions' python3 backend/import_posts.py
```

---

## Design Decisions & Rationale

### Why Two Separate Queues?
- Simplifies queue ordering logic
- Clear separation between paid and free tiers
- Easier to implement voting for free tier only
- Prevents paid requests from being affected by voting

### Why Credit System Instead of "Requests Per Month"?
- Allows users to save up credits (within limits)
- Provides flexibility for users to plan submissions
- Enables variable-cost submissions (modifiers)
- Better user experience for tier 2 (can save for 2 months to use modifiers)

### Why Monthly Credit Refresh on Login?
- Simpler than cron jobs
- No need for background workers
- Users naturally trigger refresh when they use the site
- Patreon tier is re-validated on each login

### Why Local File Storage?
- Simpler deployment (no S3 setup needed)
- Lower costs for self-hosted solution
- Images only needed temporarily (until completion)
- Can add S3 later if needed

### Why JWT Instead of Session Cookies?
- Stateless authentication (scales better)
- Works well with separate frontend/backend
- Easy to implement with FastAPI
- Session table used for token blacklisting if needed

---

## Known Issues & Future Enhancements

### Known Issues
- None currently (backend not yet tested)

### Future Enhancements (Not in Scope)
- Email notifications (requires email service)
- Discord integration (webhook notifications)
- Rush queue feature (skip positions for extra credits)
- Request templates (save common submissions)
- Batch submission for tier 4
- Gift credits between users
- Public gallery page
- Tags/categories for submissions
- Favorites system
- Mobile app

---

## Patreon Tier Configuration

**Important**: The tier detection logic in `backend/app/api/auth.py` uses placeholder thresholds. You must update the `determine_tier_from_amount()` function with your actual Patreon tier pricing:

```python
def determine_tier_from_amount(amount_cents: int) -> int:
    # UPDATE THESE VALUES based on your Patreon tiers
    if amount_cents >= 2000:  # $20+ = Tier 4
        return 4
    elif amount_cents >= 1000:  # $10+ = Tier 3
        return 3
    elif amount_cents >= 500:  # $5+ = Tier 2
        return 2
    else:  # Free = Tier 1
        return 1
```

---

## System Configuration

The `system_config` table stores configurable values. Default values:

- `tier1_votes_per_month`: 3
- `session_expiry_days`: 30
- `avg_completion_days`: 7 (for estimated completion dates)
- `max_image_size_mb`: 10
- `max_images_per_submission`: 20

These can be updated via the admin API or directly in the database.

---

## Deployment Checklist

When ready to deploy to Linode:

### Pre-Deployment
- [ ] Update Patreon OAuth redirect URI to production URL
- [ ] Generate secure SECRET_KEY for production
- [ ] Set ENVIRONMENT=production in .env
- [ ] Update FRONTEND_URL to production domain
- [ ] Set ADMIN_PATREON_ID to your actual Patreon ID

### Server Setup
- [ ] Install PostgreSQL
- [ ] Install Python 3.11+
- [ ] Install Node.js 18+
- [ ] Install nginx
- [ ] Set up firewall (allow 80, 443, SSH)

### Database
- [ ] Create production database
- [ ] Run schema.sql
- [ ] Set up automated backups
- [ ] Configure connection pooling

### Backend Deployment
- [ ] Clone repository
- [ ] Set up Python virtual environment
- [ ] Install dependencies
- [ ] Create systemd service for uvicorn
- [ ] Configure nginx reverse proxy
- [ ] Set up SSL with certbot

### Frontend Deployment
- [ ] Build production bundle (`npm run build`)
- [ ] Copy dist/ to nginx static directory
- [ ] Configure nginx to serve frontend
- [ ] Set up SPA routing (fallback to index.html)

### Post-Deployment
- [ ] Test OAuth flow with production URLs
- [ ] Test all user flows
- [ ] Test admin flows
- [ ] Set up monitoring (uptime, errors)
- [ ] Set up log rotation
- [ ] Create image cleanup cron job

---

## Contact & Support

This is a custom project. For questions or issues:
1. Check this PROJECT_PLAN.md for context
2. Review API documentation at `/docs` endpoint
3. Check database schema in schema.sql
4. Review service layer for business logic

---

## Quick Reference Commands

### Backend
```bash
# Start backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Create migration (if using alembic)
alembic revision --autogenerate -m "description"
alembic upgrade head

# Run tests
pytest

# Generate secret key
openssl rand -hex 32
```

### Frontend
```bash
# Start frontend
cd frontend && npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database
```bash
# Connect to database
psql vamasubmissions

# Backup database
pg_dump vamasubmissions > backup.sql

# Restore database
psql vamasubmissions < backup.sql

# Reset database
dropdb vamasubmissions && createdb vamasubmissions && psql vamasubmissions < schema.sql
```

---

## Session Continuation Instructions

When starting a new Goose session:

1. Say: **"Read PROJECT_PLAN.md and continue where we left off"**
2. I will:
   - Review the project status
   - Check what's completed
   - Identify the next priority task
   - Continue implementation

Current priority: **Phase 1 Frontend - Hide Legacy Pages & Build New UI**

---

## 🔄 Development Workflow

### Testing Protocol
1. **Goose makes changes** - Implements features, fixes bugs, updates code
2. **Goose notifies user** - "Changes are ready for testing"
3. **User tests locally** - Runs frontend/backend, verifies functionality
4. **User confirms** - "Looks good" or reports issues
5. **Goose commits** - Only after user approval, with descriptive commit message

### Important Notes
- **User runs servers**: User will start backend (`./start_server.sh`) and frontend (`npm run dev`) for testing
- **No auto-commits**: Goose will NEVER commit without explicit user approval
- **User tests first**: All changes must be manually tested before committing
- **Clear communication**: Goose will clearly state when changes are ready and what to test

---

*Last Updated: 2026-01-22 23:12*
*Status: Phase 1 + Post Import System COMPLETE ✅ + About Page & Latest Post Date COMPLETE ✅*

## Phase 1 + Post Import Progress Summary

### ✅ Backend Complete (2026-01-14 + 2026-01-22)
- Database: 7 tables (4 Phase 1 + 3 Post Import), 2,691+ posts imported
- Models: 6 SQLAlchemy models with relationships
- Schemas: 25+ Pydantic validation schemas (including PostStatus enum)
- Services: 4 service files with full business logic (added patreon_service.py)
- API: 25+ endpoints across 4 route files (added 8 admin import endpoints)
- All routes tested and registered in main.py
- gallery-dl integration for Patreon post fetching

### ✅ Frontend Complete (2026-01-22)
- **SearchPage**: Full-featured with autocomplete, filters, edit modal, title search
- **CommunityRequestsPage**: Form, queue, my requests, delete with banners
- **ReviewEditsPage**: Pending/history tabs, approve/reject/undo with banners
- **ImportPostsPage**: Complete admin workflow (import, tag, publish, skip, bulk operations)
- **Header**: Updated navigation with admin-only Import Posts link
- **App.jsx**: Routes configured, legacy pages hidden
- **UI/UX**: Zero disruptive popups! All feedback via non-blocking banners

### 🎉 Key Achievements (2026-01-22)
- ✅ **Post Import System**: Full workflow from Patreon → pending → published/skipped
- ✅ **gallery-dl Integration**: Automated post fetching with metadata
- ✅ **Skip Feature**: Mark non-character posts (announcements) as skipped
- ✅ **Title Search**: Dedicated search input for finding posts by title
- ✅ **UI Overhaul**: Replaced ALL alert/confirm/prompt with banner notifications
- ✅ **Character-Series Autocomplete**: Shows series alongside character names
- ✅ **Auto-add Series**: Automatically adds character's most common series
- ✅ **Bulk Operations**: Save/publish/delete multiple posts at once
- ✅ **Unsaved Changes Indicator**: Visual feedback for pending changes
- ✅ **Security Fix**: Removed exposed credentials from Git history

### 🎯 Next Priority: End-to-End Testing & Deployment
1. Test the new Skip feature on announcement posts
2. Test bulk operations (select multiple posts)
3. Verify published posts appear in Search page
4. Test edit suggestions workflow
5. Mobile responsiveness testing
6. Prepare for production deployment

---

## 📋 Feature Backlog (Prioritized)

### ✅ COMPLETED - 2026-01-22

#### ✅ Debug "futa" Title Search Issue
**Status**: Fixed
- **Problem**: Search for "futa" returned 2,807 posts (all posts) instead of 10
- **Root Causes**:
  1. Backend: Incorrect SQLAlchemy `any()` syntax for PostgreSQL arrays
  2. Frontend: Parameter mismatch (`query` vs `q`)
- **Solution**:
  1. Replaced `Post.characters.any()` with raw SQL `unnest()` queries
  2. Fixed frontend to send `q` parameter
  3. Added comprehensive debug logging
- **Files Modified**:
  - `backend/app/services/post_service.py` - Fixed array search logic
  - `backend/app/api/posts.py` - Added debug logging, fixed user attribute
  - `backend/app/main.py` - Added logging configuration
  - `frontend/src/pages/SearchPage.jsx` - Fixed parameter name

#### ✅ Auto-fill Feature
**Status**: Complete
- **What**: Button to auto-fill character and series from post title
- **Regex Pattern**: `^([^(]+)\s*\(([^)]+)\)` - Matches "Character (Series)"
- **Features**:
  - Title-cases extracted values
  - Prevents duplicate additions
  - Success/error feedback banners
  - Smart behavior: no-op if regex fails
- **UI Location**: First button in action row (before Save/Publish)
- **Files**: `frontend/src/pages/admin/ImportPostsPage.jsx`

#### ✅ Inline Approve/Reject in Review Edits Page
**Status**: Complete
- **What**: Replaced browser popups with inline confirmation
- **Old Flow**: Click → Browser popup → OK → Banner at bottom
- **New Flow**: Click → Inline confirm buttons → Success message in card → Auto-remove
- **Features**:
  - Double-click pattern (first click shows confirmation, second executes)
  - Inline success messages per edit
  - Auto-remove cards after 1.5 seconds
  - Reject reason input inline
  - Works for Approve/Reject/Undo
  - Error messages only at page level
- **Files**: `frontend/src/pages/ReviewEditsPage.jsx`

#### ✅ Community Requests Text Updates
**Status**: Complete
- **Changes**:
  - "Submit a New Request" → "Record a Request"
  - "When would you like this request fulfilled?" → "When did you submit this request to VAMA?"
  - "Submit Request" button → "Record Request"
  - "Community Queue" → "Known Queue"
  - Queue timestamps: "Requested for: X" + "Submitted: Y" → "Requested on: X"
  - My Requests: Removed "Submitted" timestamp, added queue position badge
- **Files**: `frontend/src/pages/CommunityRequestsPage.jsx`

### 🟢 Easy - Quick Wins (1-2 hours each)

#### 1. Disclaimers Section on Requests Page
**Difficulty**: 🟢 Easy (15 minutes)
- **What**: Add a banner/section at the top of Community Requests page
- **Implementation**: Simple HTML/JSX with styling
- **Files**: `frontend/src/pages/CommunityRequestsPage.jsx`
- **Effort**: Add a styled div with lorem ipsum text above the form

#### 2. Sort Direction Toggle (Date)
**Difficulty**: 🟢 Easy (30 minutes)
- **What**: Add dropdown/toggle to sort posts by date (newest/oldest first)
- **Implementation**: 
  - Add `order` param to search API (already supports this pattern)
  - Add UI dropdown in SearchPage
  - Make it extensible for future sort options
- **Files**: 
  - `frontend/src/pages/SearchPage.jsx` (UI)
  - `backend/app/api/posts.py` (add order param if not present)
- **Effort**: State management + API param passing

### 🟡 Medium - Moderate Effort (2-4 hours each)

#### 3. Show Pending Edits on Posts
**Difficulty**: 🟡 Medium (2 hours)
- **What**: Display pending edit suggestions on post detail/search results
- **Implementation**:
  - Add API endpoint: `GET /api/edits/pending-for-post/{post_id}`
  - Show pending edits with visual indicator (e.g., yellow badge)
  - Display in edit modal or as a section on post card
- **Files**:
  - `backend/app/api/edits.py` (new endpoint)
  - `frontend/src/pages/SearchPage.jsx` (display logic)
- **Effort**: Backend endpoint + frontend state management + UI

#### 4. Prevent Duplicate Edit Suggestions
**Difficulty**: 🟡 Medium (1 hour)
- **What**: Disallow suggesting edits for values that already exist
- **Implementation**:
  - Frontend: Disable/hide "Add" for existing values in edit modal
  - Backend: Validation in `POST /api/edits/suggest` endpoint
- **Files**:
  - `backend/app/services/edit_service.py` (validation)
  - `frontend/src/pages/SearchPage.jsx` (UI logic)
- **Effort**: Validation logic + UI state checks

#### 5. About Page with Leaderboards
**Difficulty**: 🟡 Medium (3 hours)
- **What**: New page with lorem ipsum + user leaderboards
- **Implementation**:
  - New API endpoint: `GET /api/users/leaderboard` (top 20 by edits suggested/approved)
  - Query `edit_history` table for stats
  - New frontend page with two-column layout
- **Files**:
  - `backend/app/api/users.py` (new endpoint)
  - `frontend/src/pages/AboutPage.jsx` (new page)
  - `frontend/src/App.jsx` (add route)
  - `frontend/src/components/Header.jsx` (add nav link)
- **Effort**: SQL aggregation + new page component

### 🔴 Hard - Significant Effort (4-8 hours)

#### 6. Browse Tab (Character/Series/Tags)
**Difficulty**: 🔴 Hard (6 hours)
- **What**: Tabbed interface with Search/Browse tabs, reusing results list
- **Implementation**:
  - Add tab UI to SearchPage
  - New API endpoint: `GET /api/posts/browse/{type}` (type: characters/series/tags)
    - Returns list with counts: `[{name: "Character", count: 150}, ...]`
    - Sorted by count descending
    - Paginated
  - Click on item → filters posts by that item
  - Reuse existing results list component
- **Files**:
  - `backend/app/api/posts.py` (new browse endpoint)
  - `backend/app/services/post_service.py` (aggregation queries)
  - `frontend/src/pages/SearchPage.jsx` (major refactor for tabs)
- **Effort**: 
  - Backend: SQL aggregation queries with COUNT/GROUP BY
  - Frontend: Tab state management, component extraction/reuse
- **Complexity**: Refactoring SearchPage to support multiple tabs while reusing results list

#### 7. Posts Without Tags Tab/Filter
**Difficulty**: 🟡 Medium (1 hour)
- **What**: Show posts that have empty tags array
- **Implementation**:
  - Could be a checkbox filter in Browse > Tags tab
  - Or a separate "Untagged" item at the top of tags list
  - Backend: Filter where `tags = '{}'` (empty array)
- **Files**:
  - `backend/app/services/post_service.py` (add filter)
  - `frontend/src/pages/SearchPage.jsx` (UI)
- **Effort**: Simple filter logic + UI toggle
- **Note**: Easier if done as part of Browse Tab feature

---

## 🎯 Recommended Implementation Order

### Phase 2A: Quick Wins (1 day)
1. ✅ Disclaimers section (15 min)
2. ✅ Sort direction toggle (30 min)
3. ✅ Prevent duplicate edits (1 hour)
4. ✅ Show pending edits (2 hours)

### Phase 2B: Browse & Leaderboards (2 days)
5. ✅ Browse tab with character/series/tags (6 hours)
6. ✅ Posts without tags (1 hour - integrate with browse)
7. ✅ About page with leaderboards (3 hours)

---

## 📊 Difficulty Assessment Summary

| Feature | Difficulty | Time | Complexity |
|---------|-----------|------|------------|
| Disclaimers section | 🟢 Easy | 15 min | HTML/styling only |
| Sort direction toggle | 🟢 Easy | 30 min | Simple state + API param |
| Prevent duplicate edits | 🟡 Medium | 1 hour | Validation logic |
| Show pending edits | 🟡 Medium | 2 hours | New endpoint + UI |
| About page + leaderboards | 🟡 Medium | 3 hours | SQL aggregation + new page |
| Posts without tags | 🟡 Medium | 1 hour | Filter logic |
| Browse tab | 🔴 Hard | 6 hours | Major refactor + aggregation |

**Total estimated effort**: ~14 hours (2 days of focused work)

---

## 🔒 Security & Data Quality

### Data Input Normalization & Security
**Difficulty**: 🟡 Medium (2-3 hours)
**Priority**: High (should be done before production)

#### What Needs Normalization
1. **Whitespace handling**:
   - Strip leading/trailing whitespace from all text inputs
   - Normalize multiple spaces to single space
   - Remove zero-width characters

2. **Character/Series/Tag names**:
   - Trim whitespace
   - Normalize unicode (NFD/NFC)
   - Prevent empty strings after trimming
   - Case normalization for duplicates (e.g., "Naruto" vs "naruto")

3. **User input fields**:
   - Request descriptions
   - Edit suggestions
   - Post titles (admin import)

#### Security Considerations
✅ **Already Protected** (using Pydantic + SQLAlchemy):
- SQL injection (parameterized queries)
- XSS (React escapes by default)
- CSRF (JWT tokens)

⚠️ **Need to Add**:
- Input length limits (prevent DoS)
- Sanitize special characters in search queries
- Rate limiting on API endpoints
- Validate array field sizes (max items)

#### Implementation Plan

**Backend** (`backend/app/services/`):
```python
# Create utils/validation.py
def normalize_text(text: str) -> str:
    """Normalize text input: trim, normalize unicode, remove extra spaces"""
    if not text:
        return ""
    # Strip whitespace
    text = text.strip()
    # Normalize unicode (NFC)
    import unicodedata
    text = unicodedata.normalize('NFC', text)
    # Collapse multiple spaces
    text = ' '.join(text.split())
    return text

def normalize_array_field(items: List[str]) -> List[str]:
    """Normalize array of strings, remove duplicates, filter empty"""
    normalized = [normalize_text(item) for item in items]
    # Remove empty strings
    normalized = [item for item in normalized if item]
    # Remove duplicates (case-insensitive)
    seen = set()
    result = []
    for item in normalized:
        lower = item.lower()
        if lower not in seen:
            seen.add(lower)
            result.append(item)
    return result
```

**Apply to Services**:
- `post_service.py` - normalize characters/series/tags on create/update
- `edit_service.py` - normalize edit values before suggesting
- `request_service.py` - normalize character/series names

**Frontend** (`frontend/src/utils/validation.js`):
```javascript
export const normalizeText = (text) => {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
};

export const normalizeArrayInput = (items) => {
  return items
    .map(item => normalizeText(item))
    .filter(item => item.length > 0)
    .filter((item, index, self) => 
      self.findIndex(i => i.toLowerCase() === item.toLowerCase()) === index
    );
};
```

**Apply to Components**:
- SearchPage edit modal
- ImportPostsPage character/series inputs
- CommunityRequestsPage form

#### Additional Security Measures

**Rate Limiting** (using slowapi):
```python
# backend/app/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to endpoints:
@limiter.limit("10/minute")  # 10 requests per minute
async def search_posts(...):
    ...
```

**Input Validation** (enhance Pydantic schemas):
```python
# backend/app/schemas/post.py
from pydantic import validator, Field

class PostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    characters: List[str] = Field(default=[], max_items=20)
    series: List[str] = Field(default=[], max_items=10)
    tags: List[str] = Field(default=[], max_items=30)
    
    @validator('characters', 'series', 'tags', pre=True)
    def normalize_arrays(cls, v):
        from app.utils.validation import normalize_array_field
        return normalize_array_field(v or [])
    
    @validator('title')
    def normalize_title(cls, v):
        from app.utils.validation import normalize_text
        return normalize_text(v)
```

#### Files to Modify
**Backend**:
- `backend/app/utils/validation.py` (new file)
- `backend/app/schemas/post.py` (add validators)
- `backend/app/schemas/community_request.py` (add validators)
- `backend/app/schemas/post_edit.py` (add validators)
- `backend/requirements.txt` (add slowapi for rate limiting)

**Frontend**:
- `frontend/src/utils/validation.js` (new file)
- `frontend/src/pages/SearchPage.jsx` (apply normalization)
- `frontend/src/pages/admin/ImportPostsPage.jsx` (apply normalization)
- `frontend/src/pages/CommunityRequestsPage.jsx` (apply normalization)

#### Testing Checklist
- [ ] Test with leading/trailing spaces
- [ ] Test with multiple consecutive spaces
- [ ] Test with unicode characters (emoji, accents)
- [ ] Test with very long inputs (should be rejected)
- [ ] Test with empty strings after trimming
- [ ] Test case-insensitive duplicate detection
- [ ] Test rate limiting (make rapid requests)
- [ ] Test SQL injection attempts (should be blocked by parameterization)
- [ ] Test XSS attempts (should be escaped by React)

**Estimated effort**: 2-3 hours
- 1 hour: Create validation utilities and apply to backend
- 1 hour: Apply to frontend forms
- 30 min: Add rate limiting
- 30 min: Testing

---

## 📝 Additional Feature Requests

### 8. Date of Latest Post on Import Page
**Difficulty**: 🟢 Easy (15 minutes)
**Priority**: Low

#### What
Display the timestamp of the most recent post in the database on the Import Posts page.

#### Implementation
- Query: `SELECT MAX(timestamp) FROM posts WHERE status = 'published'`
- Display near the "Fetch New Posts" button
- Format: "Latest post: January 22, 2026"
- Helps admin know when last import was

#### Files
- `backend/app/api/admin.py` - Add to pending-posts endpoint or create new stats endpoint
- `frontend/src/pages/admin/ImportPostsPage.jsx` - Display the date

**Estimated effort**: 15 minutes

---

### 9. Global Edit Suggestions (Bulk Rename)
**Difficulty**: 🔴 Hard (8-10 hours)
**Priority**: Medium-High (very useful for fixing typos)

#### What
Allow users to suggest renaming a character/series/tag across ALL posts that use it.

**Example use cases**:
- Fix typo: "Naruto Uzamaki" → "Naruto Uzumaki" (across 50 posts)
- Standardize: "Fate/Stay Night" → "Fate/stay night" (across 200 posts)
- Merge duplicates: "Saber (Fate)" → "Artoria Pendragon" (across 100 posts)

#### Implementation Challenges

**1. New Database Table** - `global_edit_suggestions`
```sql
CREATE TABLE global_edit_suggestions (
    id SERIAL PRIMARY KEY,
    suggester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(50) NOT NULL,  -- 'characters', 'series', 'tags'
    old_value TEXT NOT NULL,          -- Original value to replace
    new_value TEXT NOT NULL,          -- New value
    affected_posts_count INTEGER,     -- How many posts will be affected
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    UNIQUE(field_name, old_value, new_value, status)  -- Prevent duplicate suggestions
);

CREATE INDEX idx_global_edits_status ON global_edit_suggestions(status);
CREATE INDEX idx_global_edits_field ON global_edit_suggestions(field_name);
```

**2. Backend Logic** - Complex workflow
```python
# Step 1: Suggest global edit
POST /api/edits/suggest-global
{
  "field_name": "characters",
  "old_value": "Naruto Uzamaki",
  "new_value": "Naruto Uzumaki"
}

# Response shows affected posts count
{
  "id": 123,
  "affected_posts": 47,
  "preview": [
    {"post_id": 1, "title": "Naruto vs Sasuke"},
    {"post_id": 2, "title": "Naruto training"},
    ...  # First 5 posts
  ]
}

# Step 2: Approve global edit (different user)
POST /api/edits/approve-global/{id}

# Backend applies to ALL affected posts:
UPDATE posts 
SET characters = array_replace(characters, 'Naruto Uzamaki', 'Naruto Uzumaki')
WHERE 'Naruto Uzamaki' = ANY(characters);

# Log in edit_history for each affected post
```

**3. UI Components**

**New Page**: `GlobalEditsPage.jsx`
- Tab 1: "Suggest Global Edit"
  - Dropdown: Select field (characters/series/tags)
  - Autocomplete: Select old value (shows count of posts)
  - Input: Enter new value
  - Preview: Shows first 10 affected posts
  - Submit button
  
- Tab 2: "Pending Global Edits"
  - List of pending suggestions
  - Shows: old → new, affected count, suggester
  - Preview button (shows all affected posts)
  - Approve/Reject buttons
  
- Tab 3: "History"
  - Past global edits with timestamps
  - Shows who suggested/approved
  - Shows how many posts were affected

**Add to SearchPage**:
- When viewing a post, add "Suggest Global Edit" option
- Pre-fills the character/series/tag name
- Opens modal to enter new value

#### Workflow

**User Flow**:
1. User notices typo: "Naruto Uzamaki" appears in 47 posts
2. Goes to Global Edits page (or clicks from search)
3. Suggests: "Naruto Uzamaki" → "Naruto Uzumaki"
4. System shows preview of affected posts
5. Different user reviews and approves
6. System updates all 47 posts automatically
7. Logs 47 entries in edit_history

**Safety Measures**:
- Cannot approve own global edits
- Shows preview before approval
- Requires exact match (case-sensitive by default)
- Option for case-insensitive matching
- Tracks in audit log
- Admin can undo (reverts all posts)

#### API Endpoints

**New endpoints**:
```python
# Suggest global edit
POST /api/edits/suggest-global
Body: {field_name, old_value, new_value}
Returns: {id, affected_posts, preview[]}

# Get preview of affected posts
GET /api/edits/global/{id}/preview?limit=50
Returns: List of posts that will be affected

# List pending global edits
GET /api/edits/global/pending
Returns: List of pending global edit suggestions

# Approve global edit
POST /api/edits/global/{id}/approve
Returns: {updated_posts: 47, failed: 0}

# Reject global edit
POST /api/edits/global/{id}/reject

# Get global edit history
GET /api/edits/global/history

# Undo global edit (admin only)
POST /api/edits/global/{id}/undo
```

#### Database Migration
```sql
-- 006_add_global_edit_suggestions.sql
CREATE TABLE global_edit_suggestions (
    id SERIAL PRIMARY KEY,
    suggester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    affected_posts_count INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    UNIQUE(field_name, old_value, new_value, status)
);

CREATE INDEX idx_global_edits_status ON global_edit_suggestions(status);
CREATE INDEX idx_global_edits_field ON global_edit_suggestions(field_name);

-- Add to edit_history to track global edits
ALTER TABLE edit_history ADD COLUMN global_edit_id INTEGER REFERENCES global_edit_suggestions(id);
```

#### Files to Create/Modify

**Backend** (new):
- `backend/app/models/global_edit_suggestion.py`
- `backend/app/schemas/global_edit.py`
- `backend/app/services/global_edit_service.py`
- `backend/alembic/versions/006_add_global_edit_suggestions.sql`

**Backend** (modify):
- `backend/app/api/edits.py` - Add global edit endpoints
- `backend/app/models/edit_history.py` - Add global_edit_id column

**Frontend** (new):
- `frontend/src/pages/GlobalEditsPage.jsx`

**Frontend** (modify):
- `frontend/src/App.jsx` - Add route
- `frontend/src/components/Header.jsx` - Add nav link
- `frontend/src/pages/SearchPage.jsx` - Add "Suggest Global Edit" option

#### Complexity Breakdown

**Why this is Hard**:
1. **Database complexity**: New table, migration, relationships
2. **Bulk operations**: Updating potentially hundreds of posts atomically
3. **Preview logic**: Efficiently finding all affected posts
4. **UI complexity**: New page with multiple tabs, preview modals
5. **Safety**: Need robust validation and undo functionality
6. **Performance**: `array_replace()` on large datasets could be slow
7. **Edge cases**: 
   - What if old_value appears multiple times in same post?
   - What if new_value already exists in post? (creates duplicate)
   - Case sensitivity handling

**Estimated effort**: 8-10 hours
- 2 hours: Database schema + migration
- 2 hours: Backend service logic (suggest, approve, apply)
- 2 hours: Backend API endpoints + validation
- 3 hours: Frontend GlobalEditsPage with tabs
- 1 hour: Integration with SearchPage
- 1 hour: Testing edge cases

**Recommendation**: 
- Implement after Phase 2A/2B are complete
- Consider as Phase 3 feature
- Very valuable for data quality, but complex
- Could start with simpler version (admin-only, no preview)

---

### 10. Show Pending Edits in Edit Modal
**Difficulty**: 🟡 Medium (1-2 hours)
**Priority**: High (UX issue)

#### Problem
When user suggests an edit in the SearchPage modal:
1. Success banner appears: "Added 'tag' to tags"
2. Banner disappears after 3 seconds
3. No visual indication that edit is pending approval
4. User doesn't know if it worked or what the status is

#### Solution
Show pending edits in the edit modal with visual indicators:
- Section at top: "Pending Edits for This Post"
- List pending edits with badges:
  - `[ADD] Character: "New Character"` (yellow badge, pending)
  - `[DELETE] Tag: "old-tag"` (yellow badge, pending)
- Show who suggested it and when
- If user suggested it themselves, show "Your suggestion (pending approval)"
- If someone else suggested it, show "Pending approval by @username"

#### Implementation
**Backend**:
- Endpoint already exists: `GET /api/edits/pending` (but needs filtering)
- Add: `GET /api/edits/pending-for-post/{post_id}`
- Returns list of pending edits for specific post

**Frontend**:
- Fetch pending edits when opening edit modal
- Display in collapsible section at top
- Show status badges (yellow = pending, green = approved recently)
- Update after suggesting new edit (add to list immediately)

#### Files
- `backend/app/api/edits.py` - Add `GET /api/edits/pending-for-post/{post_id}`
- `frontend/src/pages/SearchPage.jsx` - Fetch and display pending edits in modal

**Estimated effort**: 1-2 hours

---

### 11. Inline Approve/Reject in Review Edits Page
**Difficulty**: 🟢 Easy (30 minutes)
**Priority**: High (UX annoyance)

#### Problem
Current flow on ReviewEditsPage:
1. Click "Approve" button
2. Browser popup: "Are you sure?"
3. Click OK
4. Banner appears at bottom of page
5. Annoying for bulk approvals

#### Solution
Replace browser confirm with inline confirmation:

**Before** (current):
```
[Edit Card]
  ADD Character: "Naruto"
  [Approve] [Reject]
```

**After** (improved):
```
[Edit Card]
  ADD Character: "Naruto"
  [Approve] [Reject]
  
  (After clicking Approve, button changes to:)
  [✓ Confirm Approve] [Cancel]
  
  (After confirming, shows inline success:)
  ✓ Approved! (green text, fades after 2 seconds)
```

#### Implementation
**State management**:
- Track which edit is in "confirm mode": `confirmingAction: {editId: 123, action: 'approve'}`
- First click: Show confirm button
- Second click: Execute action
- Cancel: Reset state

**UI changes**:
- Replace browser `confirm()` with state-based UI
- Show inline success/error message (not page-level banner)
- Auto-remove card from pending list after success
- Keep page-level banner for errors only

#### Files
- `frontend/src/pages/ReviewEditsPage.jsx` - Replace confirm dialogs with inline confirmation

**Estimated effort**: 30 minutes

---

## 📊 Updated Quick Wins List

### Phase 2A: Quick Wins (Updated - 6 hours)
1. ✅ Disclaimers section (15 min)
2. ✅ Sort direction toggle (30 min)
3. ✅ Prevent duplicate edits (1 hour)
4. ✅ Show pending edits in modal (1-2 hours) - **NEW**
5. ✅ Inline approve/reject (30 min) - **NEW**
6. ✅ Date of latest post (15 min)
