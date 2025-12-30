# Testing Checklist - Patreon Character Submission Site

## Test Users (Mock Auth)
- **Tier 1 (Free)**: tier1user
- **Tier 2**: tier2user
- **Tier 3**: tier3user
- **Tier 4**: tier4user
- **Admin**: adminuser
- **Creator**: creatoruser

---

## 1. Authentication & Authorization

### Login Flow
- [ ] Can access login page
- [ ] Can select mock user from dropdown
- [ ] Login redirects to dashboard
- [ ] Invalid credentials show error message
- [ ] Token is stored in localStorage
- [ ] Refresh page maintains logged-in state

### Authorization
- [ ] Unauthenticated users redirected to login
- [ ] Tier 1 users cannot access admin pages
- [ ] Tier 2-4 users cannot access admin pages
- [ ] Admin/Creator can access admin pages
- [ ] Logout clears token and redirects to login

---

## 2. Dashboard (All Users)

### User Info Display
- [ ] Shows correct username
- [ ] Shows correct tier (1-4)
- [ ] Shows correct role (user/admin/creator)
- [ ] Shows available credits
- [ ] Shows pending requests count
- [ ] Shows completed requests count

### Submissions List
- [ ] Shows user's submissions
- [ ] Each submission shows: character name, series, status, position
- [ ] Can click to view submission details
- [ ] Empty state shown when no submissions
- [ ] Submissions sorted by creation date (newest first)

### Navigation
- [ ] "New Submission" button visible and works
- [ ] "View Queue" button visible and works
- [ ] "Search Completed" button visible and works
- [ ] Header navigation works (Dashboard, Submit, Queue, Search)
- [ ] Admin link only visible to admin/creator

---

## 3. Create Submission

### Form Validation
- [ ] Character name is required
- [ ] Series is required
- [ ] Description is optional
- [ ] Cannot submit without required fields
- [ ] Error messages display for missing fields

### Character Info
- [ ] Can enter character name (text input)
- [ ] Can enter series name (text input with autocomplete)
- [ ] Series autocomplete suggests existing series
- [ ] Can type custom series if not in autocomplete
- [ ] Can enter description (textarea)

### Image Upload
- [ ] Can click to select images
- [ ] Can drag and drop images
- [ ] Shows preview thumbnails
- [ ] Shows file name and size
- [ ] Can remove individual images
- [ ] Maximum 20 images enforced
- [ ] Maximum 10MB per image enforced
- [ ] Error shown for oversized files
- [ ] Error shown for too many files

### Privacy Setting
- [ ] Public/Private radio buttons visible
- [ ] Public selected by default
- [ ] Can toggle between public/private
- [ ] Selection persists when form is filled

### Request Modifiers (Tier 2+)
- [ ] "Larger Image Set" checkbox visible for Tier 2+
- [ ] "Double Character" checkbox visible for Tier 2+
- [ ] Modifiers NOT visible for Tier 1
- [ ] Checking modifier shows +1 credit cost
- [ ] Total cost updates when modifiers checked

### Credit Check
- [ ] Shows current credits available
- [ ] Shows cost of submission (1 + modifiers)
- [ ] Cannot submit if insufficient credits
- [ ] Error message shown for insufficient credits

### Submission Success
- [ ] Success message shown after submit
- [ ] Redirects to dashboard after submit
- [ ] New submission appears in dashboard
- [ ] Credits deducted correctly

---

## 4. View Submission Details

### Basic Info Display
- [ ] Character name displayed
- [ ] Series displayed
- [ ] Description displayed (or "No description")
- [ ] Status displayed (pending/in_progress/completed)
- [ ] Created date displayed
- [ ] Queue position displayed (if pending)

### Images Display
- [ ] All uploaded images shown as thumbnails
- [ ] Can click thumbnail to view full size
- [ ] Image count displayed
- [ ] "No images" message if none uploaded

### Modifiers Display
- [ ] Shows if "Larger Image Set" applied
- [ ] Shows if "Double Character" applied
- [ ] Shows total credits spent

### Owner Actions
- [ ] "Edit" button visible if status is pending
- [ ] "Cancel" button visible if status is pending
- [ ] Edit button navigates to edit page
- [ ] Cancel button prompts for confirmation

### Admin/Creator View
- [ ] Shows all submission details
- [ ] Shows submitter username
- [ ] Shows admin notes (if any)
- [ ] Shows workflow start/end times
- [ ] Shows Patreon post link (if completed)

---

## 5. Edit Submission

### Edit Restrictions
- [ ] Can only edit own submissions
- [ ] Can only edit if status is "pending"
- [ ] Cannot edit if status is "in_progress" or "completed"
- [ ] Redirected if not authorized

### Editable Fields
- [ ] Character name pre-filled and editable
- [ ] Series pre-filled and editable
- [ ] Description pre-filled and editable
- [ ] Privacy setting pre-selected
- [ ] Existing images shown
- [ ] Can remove existing images
- [ ] Can add new images (up to 20 total)

### Modifiers
- [ ] Existing modifiers pre-checked
- [ ] Can toggle modifiers on/off
- [ ] Credit cost updates with changes
- [ ] Cannot save if insufficient credits for new modifiers

### Save Changes
- [ ] "Save Changes" button updates submission
- [ ] Success message shown
- [ ] Redirects to submission detail page
- [ ] Changes reflected immediately

---

## 6. Cancel Submission

### Cancellation Flow
- [ ] Cancel button shows confirmation dialog
- [ ] Confirmation shows credit refund amount
- [ ] "Confirm" proceeds with cancellation
- [ ] "Cancel" closes dialog without action

### After Cancellation
- [ ] Submission status changed to "cancelled"
- [ ] Credits refunded to user
- [ ] Removed from queue
- [ ] Success message shown
- [ ] Redirected to dashboard

---

## 7. Queue View

### Paid Queue (Tier 2+)
- [ ] Tab labeled "Paid Queue" visible
- [ ] Shows all paid tier submissions (Tier 2, 3, 4)
- [ ] Ordered by submission date (FIFO)
- [ ] Shows position number
- [ ] Shows character name, series, submitter
- [ ] Shows tier badge
- [ ] Shows modifiers if applied
- [ ] Can click to view details
- [ ] Empty state if no paid submissions

### Free Queue (Tier 1)
- [ ] Tab labeled "Free Queue" visible
- [ ] Shows all Tier 1 submissions
- [ ] Ordered by vote count (highest first)
- [ ] Shows vote count for each submission
- [ ] Shows character name, series, submitter
- [ ] Can click to view details
- [ ] Empty state if no free submissions

### Voting (Tier 1 Users)
- [ ] Vote buttons visible on free queue submissions
- [ ] Shows remaining votes (e.g., "3 votes left")
- [ ] Can upvote submission (vote count increases)
- [ ] Cannot vote if no votes remaining
- [ ] Cannot vote on own submissions
- [ ] Vote count updates in real-time
- [ ] Error message if vote fails

### Voting (Tier 2+ Users)
- [ ] Tier 2+ users can also vote on free queue
- [ ] Same voting rules apply
- [ ] Shows remaining votes

### Queue Filtering
- [ ] Can toggle between Paid and Free queue tabs
- [ ] Active tab highlighted
- [ ] Queue updates when switching tabs

---

## 8. Search Completed Requests

### Search Interface
- [ ] Search input field visible
- [ ] Can search by character name
- [ ] Can search by series name
- [ ] Search is case-insensitive
- [ ] Search button triggers search
- [ ] Can press Enter to search

### Search Results
- [ ] Shows matching completed submissions
- [ ] Each result shows: character, series, completion date
- [ ] Shows thumbnail if images exist
- [ ] Can click to view full details
- [ ] Shows "No results" if no matches
- [ ] Shows all completed requests if search is empty

### Result Details
- [ ] Clicking result navigates to detail page
- [ ] Detail page shows all submission info
- [ ] Shows Patreon post link if available
- [ ] Shows completion date
- [ ] Shows images gallery

---

## 9. Admin Dashboard

### Stats Overview
- [ ] Total submissions count displayed
- [ ] Pending submissions count displayed
- [ ] In-progress submissions count displayed
- [ ] Completed submissions count displayed
- [ ] Total users count displayed
- [ ] Active users (with pending/in-progress) count displayed

### Queue Stats
- [ ] Paid queue length displayed
- [ ] Free queue length displayed
- [ ] Average wait time displayed (if applicable)

### Recent Activity
- [ ] Shows recent submissions (last 10)
- [ ] Each shows: character, series, submitter, status, date
- [ ] Can click to view/manage submission

### Navigation
- [ ] Link to "Manage Submissions" (TODO)
- [ ] Link to "Manage Users" (TODO)
- [ ] Link to "System Settings" (TODO)

---

## 10. Admin - Manage Submissions (TODO)

### Submissions List
- [ ] Shows all submissions (all users, all statuses)
- [ ] Can filter by status (pending/in_progress/completed/cancelled)
- [ ] Can filter by tier
- [ ] Can search by character/series/username
- [ ] Shows submission details in table/card view

### Submission Actions
- [ ] Can click to view full details
- [ ] Can change status (pending → in_progress → completed)
- [ ] Can add/edit admin notes
- [ ] Can add Patreon post link (when completed)
- [ ] Can manually adjust queue position
- [ ] Can delete submission (with confirmation)

### Workflow Management
- [ ] "Start Work" button for pending submissions
- [ ] Records workflow start time
- [ ] Changes status to "in_progress"
- [ ] "Mark Complete" button for in-progress submissions
- [ ] Prompts for Patreon post link
- [ ] Records workflow end time
- [ ] Changes status to "completed"

---

## 11. Admin - Manage Users (TODO)

### Users List
- [ ] Shows all registered users
- [ ] Shows: username, tier, role, credits, join date
- [ ] Can search by username
- [ ] Can filter by tier
- [ ] Can filter by role

### User Actions
- [ ] Can view user's submission history
- [ ] Can manually adjust user credits
- [ ] Can change user tier (with confirmation)
- [ ] Can change user role (user/admin/creator)
- [ ] Can view credit transaction history
- [ ] Can ban/unban user (with confirmation)

### Credit Management
- [ ] "Add Credits" button opens dialog
- [ ] Can specify amount and reason
- [ ] Creates credit transaction record
- [ ] Updates user's credit balance
- [ ] "Deduct Credits" button opens dialog
- [ ] Can specify amount and reason
- [ ] Cannot deduct below 0

---

## 12. Credit System

### Credit Allocation (Monthly)
- [ ] Tier 1: No automatic credits
- [ ] Tier 2: 1 credit per month
- [ ] Tier 3: 2 credits per month
- [ ] Tier 4: 4 credits per month
- [ ] Credits added on subscription renewal date

### Credit Limits
- [ ] Tier 1: No carryover, no max
- [ ] Tier 2: Max 2 credits
- [ ] Tier 3: Max 4 credits
- [ ] Tier 4: Max 8 credits
- [ ] Excess credits not added if at max

### Credit Expiry
- [ ] Tier 2-4: Credits expire after 2 months
- [ ] Expired credits automatically removed
- [ ] User notified of expiring credits (TODO)

### Credit Usage
- [ ] 1 credit for base submission
- [ ] +1 credit for "Larger Image Set"
- [ ] +1 credit for "Double Character"
- [ ] Credits deducted on submission creation
- [ ] Credits refunded on submission cancellation

### Credit History
- [ ] User can view credit transaction history (TODO)
- [ ] Shows: date, type (earned/spent/refunded), amount, reason
- [ ] Shows remaining balance after each transaction

---

## 13. Voting System (Tier 1 Queue)

### Vote Allocation
- [ ] All users get 3 votes per month (configurable)
- [ ] Votes reset on 1st of each month
- [ ] Unused votes do not carry over

### Voting Rules
- [ ] Can vote on any Tier 1 submission in free queue
- [ ] Cannot vote on own submissions
- [ ] Cannot vote if no votes remaining
- [ ] One vote per submission per user
- [ ] Can remove vote (vote returned)

### Vote Display
- [ ] Shows total votes on each submission
- [ ] Shows user's remaining votes
- [ ] Highlights submissions user has voted on
- [ ] Vote count updates in real-time

### Queue Priority
- [ ] Free queue sorted by vote count (descending)
- [ ] Ties broken by submission date (older first)
- [ ] Position updates as votes change

---

## 14. Estimated Completion Date (TODO)

### Calculation
- [ ] Based on queue position
- [ ] Based on average completion time
- [ ] Based on creator's work rate
- [ ] Updates as queue changes

### Display
- [ ] Shown on submission detail page
- [ ] Shown in dashboard submission list
- [ ] Shown in queue view
- [ ] Format: "Estimated: [date]" or "Estimated: [X] days"

---

## 15. Notifications (TODO)

### Submission Status Changes
- [ ] Notify when submission moves to "in_progress"
- [ ] Notify when submission is completed
- [ ] Notify when submission is cancelled (by admin)

### Credit Updates
- [ ] Notify when monthly credits added
- [ ] Notify when credits expiring soon (1 week warning)
- [ ] Notify when credits expired

### Queue Updates
- [ ] Notify when moved up in queue (significant jump)
- [ ] Notify when submission is next in queue

### Notification Methods
- [ ] In-app notification badge
- [ ] Email notification (optional, user preference)
- [ ] Discord webhook (optional, user preference)

---

## 16. Mobile Responsiveness

### Layout
- [ ] Header collapses to hamburger menu on mobile
- [ ] Navigation menu accessible on mobile
- [ ] Forms stack vertically on mobile
- [ ] Cards stack vertically on mobile
- [ ] Tables scroll horizontally or convert to cards

### Touch Interactions
- [ ] Buttons large enough for touch
- [ ] Image upload works with mobile camera
- [ ] Drag-and-drop works on touch devices
- [ ] Modals/dialogs work on mobile

### Performance
- [ ] Images load efficiently on mobile
- [ ] Page load time acceptable on 3G
- [ ] No horizontal scrolling issues

---

## 17. Accessibility

### Keyboard Navigation
- [ ] All interactive elements focusable
- [ ] Tab order is logical
- [ ] Can submit forms with Enter key
- [ ] Can close modals with Escape key

### Screen Readers
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Error messages announced
- [ ] Status changes announced

### Visual
- [ ] Sufficient color contrast (WCAG AA)
- [ ] Focus indicators visible
- [ ] Text resizable without breaking layout
- [ ] No reliance on color alone for information

---

## 18. Error Handling

### Network Errors
- [ ] Shows error message if API unreachable
- [ ] Shows error message if request times out
- [ ] Retry option for failed requests

### Validation Errors
- [ ] Shows field-specific error messages
- [ ] Highlights invalid fields
- [ ] Error messages clear and actionable

### Authorization Errors
- [ ] Redirects to login on 401
- [ ] Shows error message on 403 (forbidden)
- [ ] Preserves intended destination after login

### Server Errors
- [ ] Shows user-friendly error message on 500
- [ ] Logs error details for debugging
- [ ] Provides support contact info

---

## 19. Performance

### Load Times
- [ ] Initial page load < 3 seconds
- [ ] Dashboard loads < 2 seconds
- [ ] Image upload feedback immediate
- [ ] Search results < 1 second

### Image Optimization
- [ ] Thumbnails generated for large images
- [ ] Images lazy-loaded in galleries
- [ ] Images compressed without quality loss

### Caching
- [ ] Static assets cached
- [ ] API responses cached appropriately
- [ ] User data cached in localStorage

---

## 20. Security

### Authentication
- [ ] Passwords hashed (if not using OAuth only)
- [ ] JWT tokens expire appropriately
- [ ] Tokens stored securely (httpOnly cookies or localStorage)
- [ ] Logout invalidates tokens

### Authorization
- [ ] All endpoints check user permissions
- [ ] Users can only access own data
- [ ] Admins can access all data
- [ ] No privilege escalation possible

### Input Validation
- [ ] All user input sanitized
- [ ] File uploads validated (type, size)
- [ ] SQL injection prevented (using ORM)
- [ ] XSS prevented (React escapes by default)

### Data Privacy
- [ ] Private submissions not visible to other users
- [ ] User data not exposed in API responses
- [ ] Images stored securely
- [ ] HTTPS enforced in production

---

## 21. Edge Cases

### Credit Edge Cases
- [ ] Cannot submit with 0 credits
- [ ] Cannot go negative credits
- [ ] Refund works correctly for cancelled submissions
- [ ] Credit cap enforced (Tier 2: 2, Tier 3: 4, Tier 4: 8)

### Queue Edge Cases
- [ ] Empty queue displays correctly
- [ ] Single submission queue displays correctly
- [ ] Queue position updates when submission cancelled
- [ ] Queue position updates when submission completed

### Image Edge Cases
- [ ] Can submit with 0 images
- [ ] Can submit with 20 images (max)
- [ ] Cannot submit with 21 images
- [ ] Large images handled gracefully
- [ ] Corrupted images rejected

### Voting Edge Cases
- [ ] Cannot vote with 0 votes remaining
- [ ] Removing vote returns vote to user
- [ ] Voting on last submission works
- [ ] Tie votes handled correctly (date tiebreaker)

### Submission Edge Cases
- [ ] Very long character names handled
- [ ] Very long series names handled
- [ ] Very long descriptions handled
- [ ] Special characters in names handled
- [ ] Emoji in names/descriptions handled

---

## 22. Integration Testing

### Full User Flows
- [ ] **Tier 1 Flow**: Login → Submit → View in Free Queue → Vote on others → Search completed
- [ ] **Tier 2 Flow**: Login → Check credits → Submit with modifier → View in Paid Queue → Search completed
- [ ] **Tier 3 Flow**: Login → Submit multiple → Edit submission → Cancel submission → Check refund
- [ ] **Tier 4 Flow**: Login → Submit with both modifiers → View position → Track progress
- [ ] **Admin Flow**: Login → View dashboard → Manage submission → Mark complete → Add Patreon link

### Cross-User Interactions
- [ ] User A submits, User B votes on it
- [ ] User A submits, Admin marks it complete, User A sees update
- [ ] Multiple users submit, queue order correct
- [ ] User A cancels, queue positions update for others

---

## 23. Deployment Testing (Production)

### Environment
- [ ] Environment variables set correctly
- [ ] Database connection works
- [ ] Patreon OAuth configured
- [ ] File uploads work
- [ ] HTTPS enabled
- [ ] Domain configured

### Patreon Integration
- [ ] OAuth login works
- [ ] Tier detection works
- [ ] Subscription changes reflected
- [ ] Webhook updates work (if implemented)

### Database
- [ ] Migrations applied
- [ ] Backups configured
- [ ] Connection pooling works
- [ ] Queries optimized

### Monitoring
- [ ] Error logging works
- [ ] Performance monitoring works
- [ ] Uptime monitoring works
- [ ] Alerts configured

---

## Test Execution Notes

### Priority Levels
- **P0 (Critical)**: Core functionality - must work for launch
- **P1 (High)**: Important features - should work for launch
- **P2 (Medium)**: Nice-to-have - can be fixed post-launch
- **P3 (Low)**: Edge cases - fix as time permits

### Test Environments
- **Local Dev**: Mock auth, test backend
- **Staging**: Real database, mock Patreon
- **Production**: Real database, real Patreon

### Test Data
- Use mock users for different tiers
- Create variety of submissions (with/without images, modifiers)
- Test with different queue states (empty, full, mixed)

---

## Known Issues / TODO
- [ ] Admin submission management page not implemented
- [ ] Admin user management page not implemented
- [ ] Edit submission functionality not fully tested
- [ ] Cancel submission functionality not fully tested
- [ ] Voting system needs real-world testing
- [ ] Estimated completion date not implemented
- [ ] Notification system not implemented
- [ ] Mobile responsiveness needs testing
- [ ] Accessibility audit needed
- [ ] Performance testing needed
- [ ] Security audit needed
