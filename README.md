# Patreon Character Submission Site

A web application for managing character commission requests from Patreon supporters, with tiered access and queue management.

## Features

- **Patreon OAuth Integration** - Authenticate users and verify tier membership
- **Tiered Credit System**
  - Tier 1 (Free): 1 pending request at a time
  - Tier 2: 1 credit/month, 2 credits max
  - Tier 3: 2 credits/month, 4 credits max
  - Tier 4: 4 credits/month, 8 credits max
- **Dual Queue System**
  - Paid queue (Tiers 2/3/4): Strict FIFO ordering
  - Free queue (Tier 1): Vote-based priority
- **Request Modifiers**
  - Large image set (+1 credit)
  - Double character (+1 credit)
- **Admin Dashboard** - Track completions, manage queue, view statistics
- **Search & History** - Search completed requests by character/series

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite
- **Database**: PostgreSQL
- **Authentication**: Patreon OAuth 2.0
- **Image Storage**: Local filesystem

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
