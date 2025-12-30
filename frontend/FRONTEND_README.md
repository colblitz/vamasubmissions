# Frontend - Patreon Character Submission Site

React + Vite frontend for the character submission system.

## Status

### ✅ COMPLETED
- React + Vite setup with Tailwind CSS
- Mock authentication system (for development without Patreon)
- API client with axios
- Authentication context and protected routes
- Layout components (Header, Footer)
- **User Pages:**
  - Login page (with mock user selection)
  - Dashboard (submissions list, stats, credits)
  - Submission form (with image upload, autocomplete, cost calculator)
  - Queue page (paid/free queues, voting)
  - Search page (search completed requests)
  - Submission detail page (view submission)
  - Submission edit page (edit pending submissions)
- **Admin Pages:**
  - Admin dashboard (statistics overview)

### 🚧 TODO
- Admin submissions management page
- Admin users management page
- Error toast notifications
- Loading state improvements
- Mobile responsiveness testing
- Integration testing with backend

## Quick Start

### Install Dependencies
```bash
npm install
```

### Development Server
```bash
npm run dev
```

Visit http://localhost:5173

### Build for Production
```bash
npm run build
```

## Mock Authentication

The frontend includes a mock authentication system for development without Patreon OAuth.

### Enable Mock Auth
Set in `.env`:
```
VITE_USE_MOCK_AUTH=true
```

### Available Mock Users

| User Type | Tier | Role    | Credits | Description |
|-----------|------|---------|---------|-------------|
| tier1     | 1    | patron  | 0       | Free tier, 1 pending request limit |
| tier2     | 2    | patron  | 2       | $5 tier, 1 credit/month |
| tier3     | 3    | patron  | 4       | $10 tier, 2 credits/month |
| tier4     | 4    | patron  | 8       | $20 tier, 4 credits/month |
| admin     | 4    | admin   | 8       | Admin access |
| creator   | 4    | creator | 8       | Creator access |

### Using Mock Auth

1. Visit `/login`
2. Select a user type from dropdown
3. Click "Login as [username]"
4. You'll be logged in as that user

### Switching to Real Patreon OAuth

1. Set `VITE_USE_MOCK_AUTH=false` in `.env`
2. Configure backend Patreon OAuth credentials
3. Login will redirect to Patreon authorization

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── ProtectedRoute.jsx      # Route protection
│   │   ├── layout/
│   │   │   ├── Header.jsx              # Navigation header
│   │   │   └── Layout.jsx              # Main layout wrapper
│   │   ├── submission/                 # (future) Submission components
│   │   ├── queue/                      # (future) Queue components
│   │   ├── admin/                      # (future) Admin components
│   │   └── common/                     # (future) Shared components
│   │
│   ├── pages/
│   │   ├── LoginPage.jsx               # Login with mock user selection
│   │   ├── CallbackPage.jsx            # OAuth callback handler
│   │   ├── DashboardPage.jsx           # User dashboard
│   │   ├── SubmitPage.jsx              # Submission form
│   │   ├── QueuePage.jsx               # Queue views
│   │   ├── SearchPage.jsx              # Search completed requests
│   │   ├── SubmissionDetailPage.jsx    # View submission
│   │   ├── SubmissionEditPage.jsx      # Edit submission
│   │   └── admin/
│   │       └── AdminDashboardPage.jsx  # Admin dashboard
│   │
│   ├── services/
│   │   ├── api.js                      # API client (axios)
│   │   └── mockAuth.js                 # Mock authentication
│   │
│   ├── contexts/
│   │   └── AuthContext.jsx             # Authentication state
│   │
│   ├── hooks/                          # (future) Custom hooks
│   ├── utils/                          # (future) Utility functions
│   │
│   ├── App.jsx                         # Main app with routing
│   ├── main.jsx                        # Entry point
│   └── index.css                       # Tailwind + global styles
│
├── public/                             # Static assets
├── .env                                # Environment variables
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## API Integration

All API calls go through `src/services/api.js` which provides:

- Automatic token injection from localStorage
- Error handling (401 redirects to login)
- Organized API methods by domain

### API Modules

```javascript
import { 
  authAPI,           // Authentication
  usersAPI,          // User operations
  submissionsAPI,    // Submission CRUD
  queueAPI,          // Queue & voting
  adminAPI           // Admin operations
} from './services/api';
```

### Example Usage

```javascript
// Get current user
const response = await usersAPI.getMe();

// Create submission
const formData = new FormData();
formData.append('character_name', 'Asuka');
formData.append('series', 'Evangelion');
// ...
const submission = await submissionsAPI.create(formData);

// Vote for submission
await queueAPI.vote(submissionId);
```

## Styling

### Tailwind CSS

The project uses Tailwind CSS with custom utility classes defined in `index.css`:

```css
.btn-primary      /* Primary button */
.btn-secondary    /* Secondary button */
.btn-danger       /* Danger/delete button */
.card             /* Card container */
.input-field      /* Form input */
.label            /* Form label */
```

### Dark Mode

Dark mode is supported via Tailwind's `dark:` prefix:

```jsx
<div className="bg-white dark:bg-gray-800">
  <p className="text-gray-900 dark:text-gray-100">Text</p>
</div>
```

## Routes

### Public Routes
- `/login` - Login page (mock user selection or Patreon OAuth)
- `/auth/callback` - OAuth callback handler

### Protected Routes (Require Login)
- `/` - Redirects to `/dashboard`
- `/dashboard` - User dashboard
- `/submit` - Create new submission
- `/queue` - View queues (paid/free)
- `/search` - Search completed requests
- `/submission/:id` - View submission details
- `/submission/:id/edit` - Edit pending submission

### Admin Routes (Require Admin/Creator Role)
- `/admin` - Admin dashboard
- `/admin/submissions` - (TODO) Manage submissions
- `/admin/users` - (TODO) Manage users

## Features

### User Features

**Dashboard**
- View credit balance and tier info
- List all submissions (pending, completed, cancelled)
- Quick stats (pending, in progress, completed counts)
- Filter submissions by status

**Submission Form**
- Character name and series (with autocomplete)
- Description textarea
- Image upload (up to 20 images, 10MB each)
- Image preview with remove option
- Public/private toggle
- Request modifiers (large image set, double character)
- Real-time credit cost calculator
- Credit validation before submission

**Queue Views**
- Paid queue (FIFO ordering)
- Free queue (vote-based ordering)
- User's position indicator
- Estimated completion dates
- Vote for free tier submissions (tier 1 users)
- Vote allowance tracking

**Search**
- Search completed requests by character or series
- View public requests and own private requests
- Link to Patreon posts

**Submission Detail**
- Full submission information
- Image gallery
- Timeline (submitted, started, completed)
- Edit/cancel buttons (for pending submissions)
- Admin notes (admin only)

**Submission Edit**
- Edit character name, series, description
- Toggle public/private
- Toggle request modifiers
- Credit cost change warning
- Credit validation

### Admin Features

**Admin Dashboard**
- Queue statistics (paid, free, in progress, completed)
- Average completion time
- Popular series
- Quick links to management pages

### Mock Auth Features

**Development Mode Indicator**
- Yellow banner on login page shows mock auth is enabled
- User details preview before login
- Easy switching between user types

## Environment Variables

Create a `.env` file:

```bash
# API URL (backend)
VITE_API_URL=http://localhost:8000

# Enable mock authentication (true for development)
VITE_USE_MOCK_AUTH=true
```

## Development Tips

### Testing Different User Roles

1. Login as different mock users to test:
   - **tier1**: Free tier behavior (1 pending limit, voting)
   - **tier2/3/4**: Paid tier behavior (credits, multiple submissions)
   - **admin**: Admin dashboard access
   - **creator**: Creator-specific features

2. Test credit system:
   - Submit with modifiers to see cost changes
   - Edit submission to test credit adjustments
   - Cancel submission to test refunds

3. Test queue system:
   - Login as tier1 to test voting
   - Login as tier2+ to test paid queue
   - Check queue positions and estimates

### Common Issues

**Images not loading**
- Make sure backend is running on http://localhost:8000
- Check image paths in submission detail page
- Verify uploads directory exists in backend

**API errors**
- Check browser console for error messages
- Verify backend is running
- Check VITE_API_URL in .env

**Mock auth not working**
- Verify VITE_USE_MOCK_AUTH=true in .env
- Restart dev server after changing .env
- Clear localStorage if stuck

## Next Steps

### Remaining Pages to Build

1. **Admin Submissions Management**
   - List all submissions with filters
   - Mark submissions as complete
   - Add Patreon post links
   - Update creator notes
   - Start/complete workflow

2. **Admin Users Management**
   - List all users with stats
   - Adjust user credits
   - Change user roles
   - View user submission history

3. **Improvements**
   - Toast notification system (react-hot-toast)
   - Better loading states
   - Error boundaries
   - Form validation improvements
   - Mobile responsive testing
   - Accessibility improvements

### Integration Testing

Once backend is ready:

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Test full user flows:
   - Login (mock or real Patreon)
   - Create submission with images
   - View queues
   - Vote on submissions (tier 1)
   - Edit/cancel submissions
   - Search completed requests
4. Test admin flows:
   - View admin dashboard
   - Complete submissions
   - Manage users

## Deployment

### Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

### Deploy to Nginx

```bash
# Copy built files to nginx directory
cp -r dist/* /var/www/html/

# Configure nginx for SPA routing
# (all routes should fallback to index.html)
```

### Environment Variables for Production

Update `.env` for production:

```bash
VITE_API_URL=https://api.yourdomain.com
VITE_USE_MOCK_AUTH=false
```

Remember to rebuild after changing environment variables.

## Contributing

When adding new features:

1. Create components in appropriate directories
2. Add API methods to `services/api.js`
3. Update routes in `App.jsx`
4. Add navigation links to `Header.jsx`
5. Test with mock auth first
6. Update this README

## Notes

- All dates are displayed in user's local timezone
- Images are stored on backend, paths are relative
- Mock auth stores token in localStorage
- Real Patreon OAuth will use JWT tokens from backend
- Admin routes are protected by `requireAdmin` prop on ProtectedRoute
