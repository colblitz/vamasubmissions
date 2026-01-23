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

### Hidden Features (Future)
- Credit-based submission system
- Dual queue system (paid/free)
- Voting system
- Admin dashboard for completions

## Tech Stack

- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: React + Vite
- **Database**: PostgreSQL 14+
- **Authentication**: Patreon OAuth 2.0 + JWT
- **Deployment**: Self-hosted on Linode (planned)

## Project Structure

```
vamasubmissions/
├── backend/           # FastAPI application
│   ├── app/
│   │   ├── api/      # API routes
│   │   ├── core/     # Config, security, dependencies
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # Business logic
│   │   └── main.py   # Application entry point
│   ├── alembic/      # Database migrations
│   ├── tests/
│   └── requirements.txt
├── frontend/         # React application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.jsx
│   └── package.json
├── docs/            # Documentation
├── schema.sql       # Database schema
└── README.md
```

## Setup Instructions

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Patreon Developer Account

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your Patreon OAuth credentials and database URL

# Initialize database
psql -U postgres -c "CREATE DATABASE vamasubmissions;"
psql -U postgres -d vamasubmissions -f ../schema.sql

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API URL

# Start development server
npm run dev
```

## Configuration

### Patreon OAuth Setup

1. Go to https://www.patreon.com/portal/registration/register-clients
2. Create a new client
3. Set redirect URI to `http://localhost:8000/api/auth/callback` (development)
4. Copy Client ID and Client Secret to backend `.env`

### Environment Variables

**Backend (.env)**
```
DATABASE_URL=postgresql://user:password@localhost/vamasubmissions
PATREON_CLIENT_ID=your_client_id
PATREON_CLIENT_SECRET=your_client_secret
PATREON_REDIRECT_URI=http://localhost:8000/api/auth/callback
SECRET_KEY=your_secret_key_for_jwt
UPLOAD_DIR=./uploads
```

**Frontend (.env)**
```
VITE_API_URL=http://localhost:8000
```

## Deployment

See [docs/deployment.md](docs/deployment.md) for production deployment instructions.

## Development

- Backend runs on http://localhost:8000
- Frontend runs on http://localhost:5173
- API docs available at http://localhost:8000/docs

## License

TBD
