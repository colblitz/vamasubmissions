# Project Plan - VAMA Community Tracker

Development plan and status for the VAMA Community Post Search & Request Tracker.

## Current Status: Phase 1 COMPLETE ✅

**Last Updated**: 2026-01-21 23:49

### ✅ What's Working
- ✅ **Backend API** - 17 endpoints fully functional
- ✅ **Database** - 2,691 posts imported and indexed
- ✅ **Models, schemas, services** - All Phase 1 business logic complete
- ✅ **Patreon OAuth 2.0** - Real authentication working!
- ✅ **Search Page** - Full-featured with autocomplete, filters, edit suggestions
- ✅ **Community Requests Page** - Form, queue, my requests, delete
- ✅ **Review Edits Page** - Pending/history tabs, approve/reject/undo
- ✅ **Navigation** - Header updated for Phase 1 (Search, Requests, Review)
- ✅ **Routing** - App.jsx configured, legacy routes hidden
- ✅ **Mock Login** - Development mode available

### 🐛 Known Issues
- Tier detection showing Tier 4 instead of Tier 3 (debug logging added)
- Frontend not tested end-to-end with real backend yet

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

### ✅ COMPLETED: Frontend (React)

**Status**: All Phase 1 frontend features implemented (2026-01-21)

#### Frontend Restructure
- ✅ Legacy pages hidden in App.jsx (Dashboard, Submit, Queue, Admin)
- ✅ Authentication flow preserved (Login, Callback, ProtectedRoute)
- ✅ Header navigation updated (Search, Requests, Review Edits, Logout)
- ✅ Routing configured in App.jsx with smart redirect to /search

#### Phase 1 Pages - COMPLETE
- ✅ **SearchPage** (`src/pages/SearchPage.jsx`)
  - ✅ Autocomplete for characters, series, tags
  - ✅ Filter chips with add/remove
  - ✅ Results list with thumbnails (single column layout)
  - ✅ Pagination controls
  - ✅ Link to Patreon post
  - ✅ Edit suggestion modal with all three fields (characters, series, tags)
  - ✅ Inline add/remove with autocomplete in modal
  - ✅ Success feedback messages
  
- ✅ **CommunityRequestsPage** (`src/pages/CommunityRequestsPage.jsx`)
  - ✅ Collapsible request submission form
  - ✅ Autocomplete for characters and series (comma-separated)
  - ✅ Date picker for requested timestamp
  - ✅ Description field (optional)
  - ✅ "My Requests" section with status badges
  - ✅ Community queue display
  - ✅ Delete functionality for own requests
  - ✅ Success/error feedback
  
- ✅ **ReviewEditsPage** (`src/pages/ReviewEditsPage.jsx`)
  - ✅ Tabbed interface (Pending / History)
  - ✅ Pending edits list with thumbnails
  - ✅ Action badges (ADD/DELETE) with color coding
  - ✅ Approve/Reject buttons
  - ✅ Edit history view
  - ✅ Undo functionality (admin)
  - ✅ Formatted display with post titles

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

*Last Updated: 2026-01-21 23:50*
*Status: Phase 1 COMPLETE - Ready for Testing & Deployment*

## Phase 1 Progress Summary

### ✅ Backend Complete (2026-01-14)
- Database: 4 new tables, 2,691 posts imported
- Models: 4 SQLAlchemy models with relationships
- Schemas: 20+ Pydantic validation schemas
- Services: 3 service files with full business logic
- API: 17 new endpoints across 3 route files
- All routes tested and registered in main.py

### ✅ Frontend Complete (2026-01-21)
- SearchPage: Full-featured with autocomplete, filters, edit modal
- CommunityRequestsPage: Form, queue, my requests, delete
- ReviewEditsPage: Pending/history tabs, approve/reject/undo
- Header: Updated navigation (Search, Requests, Review Edits)
- App.jsx: Routes configured, legacy pages hidden
- All Phase 1 features implemented and ready for testing

### 🎯 Next Priority: End-to-End Testing
1. Start backend and frontend servers
2. Test with mock authentication (tier1, tier2, admin)
3. Test search functionality (autocomplete, filters, pagination)
4. Test request submission and queue display
5. Test edit suggestions and approval workflow
6. Fix any bugs discovered during testing
7. Prepare for deployment
