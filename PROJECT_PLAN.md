# Patreon Character Submission Site - Project Plan

## Project Overview

A web application for managing character commission requests from Patreon supporters. The system provides tiered access based on Patreon membership levels, with queue management, voting systems, and admin tools for the creator.

### Key Features
- Patreon OAuth authentication with tier detection
- Credit-based submission system for paid tiers
- Dual queue system (paid FIFO, free vote-based)
- Image upload and management
- Admin dashboard for creator
- Search and history of completed requests

### Tech Stack
- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: React + Vite
- **Database**: PostgreSQL 14+
- **Authentication**: Patreon OAuth 2.0 + JWT
- **Deployment**: Self-hosted on Linode

---

## Business Rules

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

## Project Status

### COMPLETED: Backend (FastAPI)

All backend functionality is implemented and ready for testing.

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

#### Models & Schemas
- ✅ SQLAlchemy models for all tables
- ✅ Pydantic schemas for request/response validation
- ✅ Proper relationships and constraints

### TODO: Frontend (React)

**Priority: HIGH** - This is the next major phase.

#### Setup
- [ ] Initialize React + Vite project
- [ ] Set up React Router
- [ ] Configure API client (axios/fetch)
- [ ] Set up state management (Context API or Zustand)
- [ ] Add UI library (Tailwind CSS + shadcn/ui recommended)

#### Pages & Components
- [ ] **Authentication**
  - [ ] Login page with "Login with Patreon" button
  - [ ] OAuth callback handler
  - [ ] Protected route wrapper
  - [ ] Session persistence (localStorage)

- [ ] **User Dashboard**
  - [ ] Display user info (tier, credits, username)
  - [ ] List user's submissions (tabs: pending, completed, cancelled)
  - [ ] Credit history view
  - [ ] Navigation to other pages

- [ ] **Submission Form**
  - [ ] Character name input
  - [ ] Series input with autocomplete
  - [ ] Description textarea
  - [ ] Image upload (drag & drop, preview)
  - [ ] Public/private toggle
  - [ ] Request modifiers checkboxes
  - [ ] Credit cost calculator
  - [ ] Form validation

- [ ] **Queue Views**
  - [ ] Paid queue page (list view)
  - [ ] Free queue page (list view with vote buttons)
  - [ ] User's position indicator
  - [ ] Estimated completion dates
  - [ ] Vote allowance display (tier 1)
  - [ ] Filter: show all public vs just mine

- [ ] **Search/History**
  - [ ] Search bar with autocomplete
  - [ ] Results grid/list
  - [ ] Filter by series
  - [ ] Link to Patreon posts
  - [ ] Submission detail modal

- [ ] **Admin Dashboard** (creator/admin only)
  - [ ] Submissions table (all queues)
  - [ ] Mark submission as complete form
  - [ ] Add Patreon post link
  - [ ] Creator notes field
  - [ ] User management table
  - [ ] Statistics dashboard
  - [ ] Credit adjustment tool

- [ ] **Edit Submission Page**
  - [ ] Pre-filled form
  - [ ] Show credit cost changes
  - [ ] Confirm before saving

#### UI/UX Considerations
- Mobile responsive design
- Loading states for API calls
- Error handling and user feedback
- Confirmation dialogs for destructive actions
- Image preview before upload
- Progress indicators for uploads
- Toast notifications for success/error

### TODO: Testing & Deployment

#### Backend Testing
- [ ] Set up pytest
- [ ] Test Patreon OAuth flow (mock)
- [ ] Test credit system
- [ ] Test queue ordering
- [ ] Test voting system
- [ ] Test permissions (admin vs user)

#### Frontend Testing
- [ ] Test user flows (submission, voting, etc.)
- [ ] Test admin flows
- [ ] Mobile responsiveness testing
- [ ] Cross-browser testing

#### Deployment
- [ ] Set up PostgreSQL on Linode
- [ ] Configure environment variables
- [ ] Deploy backend with systemd service
- [ ] Build and deploy frontend (static files)
- [ ] Configure nginx reverse proxy
- [ ] Set up SSL with Let's Encrypt
- [ ] Configure database backups
- [ ] Set up image cleanup cron job
- [ ] Set up monitoring/logging

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

## API Endpoints Reference

### Authentication (`/api/auth`)
- `GET /api/auth/login` - Redirect to Patreon OAuth
- `GET /api/auth/callback?code=...` - Handle OAuth callback, returns JWT
- `POST /api/auth/logout` - Logout (invalidate session)
- `GET /api/auth/me` - Get current user info

### Users (`/api/users`)
- `GET /api/users/me` - Get current user details
- `GET /api/users/me/credits/history?limit=50` - Get credit transaction history

### Submissions (`/api/submissions`)
- `POST /api/submissions/` - Create submission (multipart form)
  - Form fields: character_name, series, description, is_public, is_large_image_set, is_double_character
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

### Admin (`/api/admin`)
- `GET /api/admin/submissions?status=...&queue_type=...` - List all submissions
- `GET /api/admin/submissions/{id}` - Get submission (includes creator notes)
- `POST /api/admin/{id}/complete` - Mark complete (body: {patreon_post_link, creator_notes})
- `PATCH /api/admin/{id}/notes` - Update creator notes (body: notes string)
- `POST /api/admin/{id}/start` - Mark as in progress
- `GET /api/admin/stats` - Get queue statistics
- `GET /api/admin/users` - List all users with stats
- `PATCH /api/admin/users/{id}/role` - Update user role (body: role string)
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

## Development Workflow

### Starting a New Session

1. **Read this file**: "goose read PROJECT_PLAN.md and continue where we left off"
2. **Check TODO section** to see what's next
3. **Review recent changes** if needed

### Backend Development (COMPLETE)

The backend is fully implemented. To test locally:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set up database
createdb vamasubmissions
psql vamasubmissions < ../schema.sql

# Create .env file (copy from env.example and fill in values)
cp env.example .env

# Run server
uvicorn app.main:app --reload
```

Visit http://localhost:8000/docs for interactive API documentation.

### Frontend Development (NEXT PRIORITY)

To start frontend development:

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install react-router-dom axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install UI library (optional but recommended)
npx shadcn-ui@latest init

npm run dev
```

### Testing Patreon OAuth Locally

1. Create Patreon OAuth app at https://www.patreon.com/portal/registration/register-clients
2. Set redirect URI to `http://localhost:8000/api/auth/callback`
3. Add Client ID and Secret to `.env`
4. Test flow:
   - Visit http://localhost:8000/api/auth/login
   - Authorize on Patreon
   - Should redirect to frontend with token

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

Current priority: **Frontend Development (Phase 9)**

---

*Last Updated: 2025-12-27*
*Status: Backend Complete, Frontend Not Started*
