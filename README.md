# VAMA Community Post Search & Request Tracker

A community-driven web application for VAMA's Patreon subscribers to search existing posts, track community requests, and collaboratively improve post metadata.

## Current Status: Phase 1 + Post Import System COMPLETE ✅

### Active Features
- **Post Search** - Browse and search 2691+ VAMA posts by character, series, tags, or title
- **Community Request Queue** - Unofficial tracking of community requests (FIFO)
- **Collaborative Editing** - Community-approved metadata improvements with audit trail
- **Admin Post Import** - Full workflow for importing, tagging, and publishing new Patreon posts
- **Patreon OAuth** - Subscriber-only access with tier detection
- **Non-blocking UI** - All feedback via banner notifications (zero disruptive popups!)

### Admin Features
- **Import Posts** - Fetch new posts from Patreon via gallery-dl integration
- **Tag & Publish** - Review, tag, and publish pending posts
- **Skip Non-Character Posts** - Mark announcements/polls as skipped
- **Bulk Operations** - Save, publish, or delete multiple posts at once
- **Character-Series Autocomplete** - Smart suggestions with auto-association

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

---

## First Time Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Patreon Developer Account (for OAuth)

### Database Setup

```bash
# Create database
createdb vamasubmissions

# Run schema
psql vamasubmissions < schema.sql

# Run Phase 1 migrations (in order!)
psql vamasubmissions < backend/alembic/versions/002_add_phase1_tables.sql
psql vamasubmissions < backend/alembic/versions/003_add_post_status_and_raw_json.sql
psql vamasubmissions < backend/alembic/versions/004_create_admin_settings.sql
psql vamasubmissions < backend/alembic/versions/005_add_skipped_status.sql
psql vamasubmissions < backend/alembic/versions/006_add_tier_name.sql

# Import posts (requires vama_posts_initial.csv and all-post-api/)
cd backend && source venv/bin/activate && cd ..
DATABASE_URL='postgresql://yourusername@localhost/vamasubmissions' python3 backend/import_posts.py
```

**⚠️ Important: Database Migrations**

When you pull new code that adds database columns/tables, you need to run the new migration files:

```bash
# Check for new migration files
ls backend/alembic/versions/

# Run any new migrations (replace XXX with the migration number)
psql vamasubmissions < backend/alembic/versions/XXX_migration_name.sql

# Or run all migrations in order (safe to re-run)
for file in backend/alembic/versions/*.sql; do
  echo "Running $file..."
  psql vamasubmissions < "$file"
done
```

Common migration errors:
- `column X does not exist` → Run the migration that adds that column
- `relation X does not exist` → Run earlier migrations first (check numbering)

### Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration (see Environment Setup below)
```

### Frontend Setup

```bash
cd frontend
npm install

# Set up environment variables
echo "VITE_API_URL=http://localhost:8000" > .env
echo "VITE_USE_MOCK_AUTH=true" >> .env
```

---

## Mock Authentication

With `VITE_USE_MOCK_AUTH=true` in frontend `.env`, you can test as different users without Patreon OAuth:

**Available Mock Users:**
- **tier1** - Free tier user
- **tier2** - $5 tier user
- **tier3** - $10 tier user
- **tier4** - $20 tier user
- **admin** - Admin access (can import posts)

Just enter the username on the login page (no password needed).

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
VITE_USE_MOCK_AUTH=true  # Set to false for real Patreon OAuth
```

---

## Useful Commands

### Backend
```bash
# Start backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Or use the start script
cd backend && source venv/bin/activate && ./start_server.sh

# Generate secret key
openssl rand -hex 32

# Run tests
pytest
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

# Check post count
psql vamasubmissions -c "SELECT COUNT(*) FROM posts;"  # Should show 2691+

# Backup database
pg_dump vamasubmissions > backup.sql

# Restore database
psql vamasubmissions < backup.sql

# Reset database (WARNING: Deletes all data)
dropdb vamasubmissions && createdb vamasubmissions
psql vamasubmissions < schema.sql
psql vamasubmissions < backend/alembic/versions/002_add_phase1_tables.sql
# ... run other migrations ...

# Reimport posts
DATABASE_URL='postgresql://yourusername@localhost/vamasubmissions' python3 backend/import_posts.py
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Update Patreon OAuth redirect URI to production URL
- [ ] Generate secure SECRET_KEY for production (`openssl rand -hex 32`)
- [ ] Set `ENVIRONMENT=production` in backend `.env`
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Set `ADMIN_PATREON_ID` to your actual Patreon ID
- [ ] Set `VITE_USE_MOCK_AUTH=false` in frontend `.env`

### Server Setup
- [ ] Install PostgreSQL 14+
- [ ] Install Python 3.11+
- [ ] Install Node.js 18+
- [ ] Install nginx
- [ ] Set up firewall (allow ports 80, 443, SSH)

### Database
- [ ] Create production database
- [ ] Run `schema.sql`
- [ ] Run all migrations in `backend/alembic/versions/`
- [ ] Import posts using `import_posts.py`
- [ ] Set up automated backups (pg_dump cron job)
- [ ] Configure connection pooling

### Backend Deployment
- [ ] Clone repository to server
- [ ] Set up Python virtual environment
- [ ] Install dependencies (`pip install -r requirements.txt`)
- [ ] Create systemd service for uvicorn
- [ ] Configure nginx reverse proxy
- [ ] Set up SSL with certbot/Let's Encrypt

### Frontend Deployment
- [ ] Build production bundle (`npm run build`)
- [ ] Copy `dist/` to nginx static directory
- [ ] Configure nginx to serve frontend
- [ ] Set up SPA routing (fallback to `index.html`)

### Post-Deployment
- [ ] Test OAuth flow with production URLs
- [ ] Test all user flows (search, requests, edits)
- [ ] Test admin flows (import posts)
- [ ] Set up monitoring (uptime, errors)
- [ ] Set up log rotation
- [ ] Create image cleanup cron job (for uploads directory)

---

## Tech Stack

- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: React + Vite
- **Database**: PostgreSQL 14+
- **Authentication**: Patreon OAuth 2.0 + JWT
- **Styling**: Tailwind CSS
- **Deployment**: Self-hosted on Linode (planned)

---

## Project Structure

```
vamasubmissions/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/            # API route handlers
│   │   │   ├── auth.py     # Patreon OAuth, login/logout
│   │   │   ├── users.py    # User endpoints
│   │   │   ├── posts.py    # Post search & autocomplete
│   │   │   ├── community_requests.py  # Request queue
│   │   │   ├── edits.py    # Edit suggestions
│   │   │   └── admin.py    # Admin endpoints (import posts)
│   │   ├── core/           # Core utilities
│   │   │   ├── config.py   # Settings management
│   │   │   ├── database.py # DB connection
│   │   │   └── security.py # JWT, hashing
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── main.py         # Application entry point
│   ├── alembic/            # Database migrations
│   ├── tests/              # Backend tests
│   ├── uploads/            # Image storage
│   ├── requirements.txt    # Python dependencies
│   └── .env.example        # Environment template
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   │   ├── SearchPage.jsx
│   │   │   ├── CommunityRequestsPage.jsx
│   │   │   ├── ReviewEditsPage.jsx
│   │   │   └── admin/ImportPostsPage.jsx
│   │   ├── services/       # API client
│   │   ├── contexts/       # React contexts
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # Entry point
│   ├── public/             # Static assets
│   ├── package.json
│   └── vite.config.js
├── schema.sql              # Database schema
├── PROJECT_PLAN.md         # Development plan & status
├── PROJECT_LOG.md          # Historical development log
└── README.md               # This file
```

---

## Patreon OAuth Setup

1. Go to https://www.patreon.com/portal/registration/register-clients
2. Create a new client
3. Set redirect URI to:
   - Development: `http://localhost:8000/api/auth/callback`
   - Production: `https://yourdomain.com/api/auth/callback`
4. Copy Client ID and Client Secret to backend `.env`
5. Get your Creator ID from Patreon API or profile URL
6. Get your Patreon User ID for `ADMIN_PATREON_ID`

---

## Development

- **Backend**: http://localhost:8000
- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **API Redoc**: http://localhost:8000/redoc (Alternative docs)

---

## Documentation

- **README.md** - This file (setup and quick reference)
- **docs/PROJECT_PLAN.md** - Current development plan, business rules, API reference
- **docs/PROJECT_LOG.md** - Historical development log and completed features
- **docs/CDN.md** - CDN implementation guide (Cloudflare, R2, latency analysis)
- **deployment-scripts/deploy.sh** - Production deployment script (with full docs in header)

---

## Production Deployment

To deploy to production:

```bash
ssh deploy@45.33.94.21
cd ~/vamasubmissions
bash deployment-scripts/deploy.sh
```

The script automatically:
- Backs up database
- Pulls latest code
- Runs all migrations
- Updates dependencies
- Rebuilds frontend
- Restarts backend
- Verifies deployment

See `deployment-scripts/deploy.sh` header for full documentation.

---

## License

TBD
