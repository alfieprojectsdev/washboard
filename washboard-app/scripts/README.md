# Washboard Screenshot Capture Script

This directory contains automation scripts for the Washboard project.

## capture-screenshots.js

A Playwright-based script that captures professional portfolio screenshots of the Washboard car wash queue management system.

### Overview

The script captures screenshots of key user workflows:

1. **Customer Booking Form** (`01-booking-form.png`)
   - Displays the booking form after validating a magic link
   - Shows form fields for vehicle information (plate, make, model)
   - Includes optional customer details (name, Messenger contact)

2. **Booking Success Page** (`02-booking-success.png`)
   - Confirmation page shown after successful booking submission
   - Displays booking ID and queue position
   - Shows next steps for the customer

3. **Receptionist Dashboard** (`03-dashboard-queue.png`)
   - Queue management interface for receptionists
   - Real-time queue view with booking information
   - Note: Requires authentication - shows login redirect if database unavailable

4. **Magic Link Generation UI** (`04-magic-links.png`)
   - Interface for receptionists to generate customer booking links
   - Displays QR codes and magic link tokens
   - Note: Requires authentication - shows login redirect if database unavailable

### Usage

#### Quick Start (Basic UI Screenshots)

```bash
cd washboard-app
npm run dev &  # Start dev server in background on port 3000
node scripts/capture-screenshots.js
```

This captures the UI layouts. Screenshots of protected pages (dashboard, magic-links) will show login redirects if no database is configured.

#### With PostgreSQL Database (Full Screenshots)

For complete screenshots with actual dashboard and magic link UI:

```bash
# Set up database (e.g., using Supabase or local PostgreSQL)
export DATABASE_URL="postgresql://user:password@localhost:5432/washboard"

# Or use in-memory database for quick testing
export USE_MOCK_DB=true

cd washboard-app
npm run dev &
node scripts/capture-screenshots.js
```

#### With Docker (Complete Setup)

```bash
# Start dev server
cd washboard-app
npm run dev &

# Wait for server to be ready
sleep 3

# Run screenshots
node scripts/capture-screenshots.js
```

### Output

Screenshots are saved to: `/washboard-app/portfolio-screenshots/`

Each screenshot includes:
- Professional 1024x768 resolution
- Headless browser rendering (Chromium)
- Clear, high-contrast UI elements
- Relevant test data (where applicable)

File sizes are typically:
- `01-booking-form.png` - 13-14 KB
- `02-booking-success.png` - 64-65 KB
- `03-dashboard-queue.png` - 9-10 KB
- `04-magic-links.png` - 9-10 KB

### Requirements

- Node.js 18+
- npm dependencies (already installed):
  - `playwright` - Browser automation
  - `@playwright/test` - Playwright test library

Install if missing:
```bash
npm install -D playwright @playwright/test
```

### How It Works

1. **Launches Chromium** in headless mode
2. **Seeds test data** (if database available):
   - Creates receptionist account
   - Authenticates user
   - Generates magic link
3. **Captures four screenshots**:
   - Booking form (public, no auth needed)
   - Success page (public, demo params)
   - Dashboard (requires auth)
   - Magic links UI (requires auth)
4. **Gracefully handles missing database**:
   - Uses placeholder tokens for public pages
   - Shows login redirects for protected pages
   - Continues even if database operations fail

### Configuration

Environment variables:

- `BASE_URL` - Application URL (default: `http://localhost:3000`)
- `DATABASE_URL` - PostgreSQL connection string (optional)
- `USE_MOCK_DB` - Use in-memory database (optional, set to `true`)

Test data (hardcoded in script):

```javascript
{
  branch: { code: 'MAIN', name: 'Main Branch', location: '123 Car Wash Lane' },
  receptionist: { username: 'demo_receptionist', password: 'DemoPass123!' },
  customers: [
    { name: 'John Smith', plate: 'ABC-1234', make: 'Toyota', model: 'Camry' },
    { name: 'Maria Garcia', plate: 'XYZ-5678', make: 'Honda', model: 'Civic' },
    { name: 'David Chen', plate: 'DEF-9012', make: 'Ford', model: 'F-150' }
  ]
}
```

Modify these values in the script if needed for custom test data.

### Database Notes

**Development (No Database)**:
- Public pages capture successfully
- Protected pages show login redirects
- Good for UI/layout verification

**With PostgreSQL**:
- All pages capture with real data
- Magic links are created and valid
- Dashboard shows actual queue
- Provides complete portfolio coverage

**Recommended for Production Portfolios**:
1. Set up PostgreSQL locally or use cloud provider
2. Configure `DATABASE_URL` environment variable
3. Ensure dev server is running
4. Run script to capture all pages with real data

### Troubleshooting

**"Port 3000 already in use"**:
```bash
lsof -ti:3000 | xargs kill -9
npm run dev &
```

**"Failed to launch Chromium"**:
Playwright may need additional system libraries:
```bash
# On Ubuntu/Debian
sudo apt-get install -y libgdk-pixbuf2.0-0 libx11-6
```

**Screenshots show 404 errors**:
- This is expected for dashboard pages without authentication
- Set up a database and run the script with `DATABASE_URL` set
- Or use `USE_MOCK_DB=true` for in-memory testing

**Magic link appears invalid**:
- Placeholder tokens are used when database is unavailable
- Set up a database to generate real magic links
- Check that receptionist account creation succeeded

### Integration

To use these scripts in CI/CD:

```yaml
# Example: GitHub Actions
- name: Capture Portfolio Screenshots
  run: |
    npm run dev &
    sleep 3
    node scripts/capture-screenshots.js
```

### Future Enhancements

- [ ] Add touch-target testing for mobile
- [ ] Generate QR code images separately
- [ ] Support multiple viewport sizes
- [ ] Create video walkthroughs
- [ ] Automated screenshot diff detection

---

**Last Updated**: 2025-11-08
**Script Version**: 1.0
**Compatible With**: Washboard v0.1.0+
