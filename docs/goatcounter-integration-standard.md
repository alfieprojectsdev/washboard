<!-- copied from claude-config/coordination/standards/goatcounter-integration-standard.md -->
# GoatCounter Analytics Integration Standard

**Version:** 1.0
**Last Updated:** 2025-11-03
**Owner:** Root Claude (RCC)
**Applies To:** All Alfie projects

---

## Overview

This document provides a standardized approach for integrating GoatCounter analytics across all projects. GoatCounter is a privacy-friendly, lightweight analytics solution that tracks pageviews and custom events without cookies or personal data collection.

**GoatCounter Account:** `https://ithinkandicode.goatcounter.com/`

---

## Why GoatCounter?

- **Privacy-first:** No cookies, no tracking of personal data
- **Lightweight:** ~3.5KB script, minimal performance impact
- **GDPR/CCPA compliant:** No consent banners needed
- **Open source:** Transparent and auditable
- **Free tier:** Generous limits for personal projects
- **Event tracking:** Custom event tracking for user interactions

---

## Implementation Levels

All projects must implement **Level 1 (Basic Pageviews)**. Levels 2 and 3 are recommended for production projects.

### Level 1: Basic Pageview Tracking (REQUIRED)

**What:** Track page visits automatically
**Effort:** 2 minutes
**Status:** All projects must have this minimum

### Level 2: Event Tracking (RECOMMENDED)

**What:** Track user interactions (button clicks, form submissions, feature usage)
**Effort:** 15-30 minutes
**Status:** Required for production projects with user interaction

### Level 3: Funnel & Conversion Tracking (OPTIONAL)

**What:** Track multi-step user journeys (signup flows, checkout, onboarding)
**Effort:** 1-2 hours
**Status:** Recommended for B2B/SaaS projects (pipetgo, parkboard)

---

## Level 1: Basic Pageview Tracking

### For Static HTML Sites (windowcards, landingpage)

**Add to `<head>` or before `</body>`:**

```html
<!-- GoatCounter Analytics -->
<script data-goatcounter="https://ithinkandicode.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
```

**Example (index.html):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
</head>
<body>
  <h1>Welcome</h1>

  <!-- GoatCounter at end of body -->
  <script data-goatcounter="https://ithinkandicode.goatcounter.com/count"
          async src="//gc.zgo.at/count.js"></script>
</body>
</html>
```

**Status Check:**
- ✅ windowcards: COMPLETE (line 78 of index.html)
- 🔲 landingpage: TODO
- 🔲 Other static sites: TODO

---

### For Next.js Projects (pipetgo, parkboard)

**Option A: Script in `app/layout.tsx` (Recommended for App Router)**

```tsx
// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* GoatCounter Analytics */}
        <Script
          data-goatcounter="https://ithinkandicode.goatcounter.com/count"
          src="https://gc.zgo.at/count.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
```

**Option B: Environment-based (Production only)**

```tsx
// app/layout.tsx
import Script from 'next/script'

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* GoatCounter Analytics - Production only */}
        {IS_PRODUCTION && (
          <Script
            data-goatcounter="https://ithinkandicode.goatcounter.com/count"
            src="https://gc.zgo.at/count.js"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
```

**Status Check:**
- 🔲 pipetgo: TODO (Add to `src/app/layout.tsx`)
- 🔲 parkboard: TODO (Add to `app/layout.tsx`)

---

### For Node.js/Express Projects (carpool-app)

**Option A: Script in HTML template**

```html
<!-- views/layout.ejs or base template -->
<!DOCTYPE html>
<html>
<head>
  <title><%= title %></title>
</head>
<body>
  <%- body %>

  <!-- GoatCounter Analytics -->
  <script data-goatcounter="https://ithinkandicode.goatcounter.com/count"
          async src="//gc.zgo.at/count.js"></script>
</body>
</html>
```

**Option B: Middleware (if serving static HTML)**

```javascript
// server.js or app.js
app.use((req, res, next) => {
  res.locals.goatCounterScript = process.env.NODE_ENV === 'production'
    ? '<script data-goatcounter="https://ithinkandicode.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>'
    : '';
  next();
});
```

Then in templates:
```html
<%- goatCounterScript %>
```

**Status Check:**
- 🔲 carpool-app: TODO

---

## Level 2: Event Tracking (Recommended)

### What to Track

**User Interactions:**
- Button clicks (primary CTAs)
- Form submissions (signup, quote requests, bookings)
- Feature usage (filters, search, sorting)
- Navigation (tab switches, modal opens)
- Downloads (PDFs, reports, results)

**Business Events:**
- Quote requests (pipetgo)
- Booking attempts (parkboard, carpool-app)
- Service selections (pipetgo)
- Slot reservations (parkboard)
- Worksheet generations (windowcards)

**DO NOT track:**
- Personal data (names, emails, IDs)
- Financial data (prices, payment info)
- Sensitive content (test results, lab data)

---

### Event Tracking Implementation

**Basic Pattern (Vanilla JS/HTML):**

```javascript
// Track button click
function trackEvent(eventName) {
  if (window.goatcounter) {
    window.goatcounter.count({
      path: eventName,
      title: eventName,
      event: true
    });
  }
}

// Usage
document.getElementById('generate-btn').addEventListener('click', () => {
  trackEvent('worksheet-generate');
  generateWorksheet(); // Your actual function
});
```

**React/Next.js Pattern:**

```typescript
// lib/analytics.ts
export function trackEvent(eventName: string, data?: Record<string, string>) {
  if (typeof window !== 'undefined' && window.goatcounter) {
    window.goatcounter.count({
      path: eventName,
      title: eventName,
      event: true
    });
  }
}

// Usage in component
import { trackEvent } from '@/lib/analytics'

export function QuoteRequestButton() {
  const handleClick = () => {
    trackEvent('quote-request-clicked');
    // Your actual logic
  };

  return <button onClick={handleClick}>Request Quote</button>
}
```

**TypeScript Declaration (for Next.js projects):**

```typescript
// types/goatcounter.d.ts
interface GoatCounter {
  count: (options: {
    path: string;
    title?: string;
    event?: boolean;
    referrer?: string;
  }) => void;
}

declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

export {};
```

---

### Project-Specific Event Examples

#### Windowcards (Static HTML)

**Events to track:**
- Worksheet generation
- Operator selection changes
- Print button clicks
- Toggle answers
- Practice mode activation

**Implementation (script.js):**

```javascript
// Add to existing functions

// Helper function
function trackEvent(eventName) {
  if (window.goatcounter) {
    window.goatcounter.count({
      path: `/event/${eventName}`,
      title: eventName,
      event: true
    });
  }
}

// In generate() function
function generate() {
  const operator = document.getElementById("operator").value;
  const digits = document.getElementById("numDigits").value;

  trackEvent(`generate-${operator}-${digits}digit`);

  // ... existing generation logic
}

// In toggleAnswers() function
function toggleAnswers() {
  trackEvent('toggle-answers');
  // ... existing toggle logic
}

// In togglePracticeMode() function
function togglePracticeMode() {
  trackEvent('practice-mode-toggle');
  // ... existing practice mode logic
}

// In window.print()
document.querySelector('button[onclick="window.print()"]')?.addEventListener('click', () => {
  trackEvent('print-worksheet');
});
```

---

#### PipetGo (Next.js B2B Marketplace)

**Events to track:**
- Service browsing (by pricing mode)
- Quote requests
- Quote provision (lab admin)
- Quote approval (client)
- Order status changes
- Lab profile views
- Service detail views

**Implementation:**

```typescript
// src/lib/analytics.ts
export function trackEvent(eventName: string) {
  if (typeof window !== 'undefined' && window.goatcounter) {
    window.goatcounter.count({
      path: `/event/${eventName}`,
      title: eventName,
      event: true
    });
  }
}

// Specific event functions
export const analytics = {
  quoteRequested: () => trackEvent('quote-requested'),
  quoteProvided: () => trackEvent('quote-provided'),
  quoteApproved: () => trackEvent('quote-approved'),
  serviceViewed: (pricingMode: string) => trackEvent(`service-viewed-${pricingMode}`),
  orderCreated: (pricingMode: string) => trackEvent(`order-created-${pricingMode}`),
  labProfileViewed: () => trackEvent('lab-profile-viewed'),
};

// Usage in components
import { analytics } from '@/lib/analytics'

// In quote request form
const handleSubmit = async () => {
  await createOrder();
  analytics.quoteRequested();
};

// In service catalog
const handleServiceClick = (service) => {
  analytics.serviceViewed(service.pricingMode);
  router.push(`/services/${service.id}`);
};
```

---

#### Parkboard (Next.js Parking Marketplace)

**Events to track:**
- Slot searches (by date/location)
- Slot detail views
- Booking attempts
- Booking confirmations
- Pricing mode filter usage
- Lab profile views (if applicable)

**Implementation:**

```typescript
// lib/analytics.ts
export const analytics = {
  slotSearched: (filters: { date?: string; location?: string }) =>
    trackEvent('slot-searched'),
  slotViewed: (pricingMode: string) =>
    trackEvent(`slot-viewed-${pricingMode}`),
  bookingAttempted: () =>
    trackEvent('booking-attempted'),
  bookingConfirmed: () =>
    trackEvent('booking-confirmed'),
  filterApplied: (filterType: string) =>
    trackEvent(`filter-${filterType}`),
};
```

---

#### Carpool App (Node.js/Express)

**Events to track:**
- Ride posted
- Interest expressed
- Ride search
- Vehicle info viewed
- Contact initiated

**Implementation (public/js/analytics.js):**

```javascript
// public/js/analytics.js
window.analytics = {
  trackEvent: function(eventName) {
    if (window.goatcounter) {
      window.goatcounter.count({
        path: '/event/' + eventName,
        title: eventName,
        event: true
      });
    }
  },

  ridePosted: function() { this.trackEvent('ride-posted'); },
  interestExpressed: function() { this.trackEvent('interest-expressed'); },
  rideSearched: function() { this.trackEvent('ride-searched'); },
  vehicleInfoViewed: function() { this.trackEvent('vehicle-info-viewed'); },
};

// Usage in HTML
<button onclick="window.analytics.ridePosted(); submitForm();">
  Post Ride
</button>
```

---

#### Landing Page (Static Portfolio)

**Events to track:**
- Project card clicks
- GitHub link clicks
- Demo link clicks
- Skills section scrolls
- Contact button clicks (if applicable)

**Implementation:**

```javascript
// In index.html or separate analytics.js

function trackEvent(eventName) {
  if (window.goatcounter) {
    window.goatcounter.count({
      path: `/event/${eventName}`,
      title: eventName,
      event: true
    });
  }
}

// Track project card clicks
document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('click', (e) => {
    const projectName = card.dataset.project; // e.g., data-project="pipetgo"
    trackEvent(`project-card-${projectName}`);
  });
});

// Track external links
document.querySelectorAll('a[href^="https://github.com"]').forEach(link => {
  link.addEventListener('click', () => {
    trackEvent('github-link-clicked');
  });
});

document.querySelectorAll('.demo-link').forEach(link => {
  link.addEventListener('click', () => {
    const projectName = link.dataset.project;
    trackEvent(`demo-clicked-${projectName}`);
  });
});
```

---

## Level 3: Funnel & Conversion Tracking (Optional)

### What to Track

**Multi-step workflows:**
- User onboarding (signup → profile → first action)
- Quote workflow (request → provision → approval)
- Booking workflow (search → select → confirm)
- Checkout flows (cart → payment → confirmation)

**Implementation Pattern:**

```typescript
// lib/analytics.ts
export const funnels = {
  quoteWorkflow: {
    step1_requested: () => trackEvent('funnel/quote/1-requested'),
    step2_provided: () => trackEvent('funnel/quote/2-provided'),
    step3_approved: () => trackEvent('funnel/quote/3-approved'),
  },

  bookingWorkflow: {
    step1_search: () => trackEvent('funnel/booking/1-search'),
    step2_select: () => trackEvent('funnel/booking/2-select'),
    step3_confirm: () => trackEvent('funnel/booking/3-confirm'),
  },
};

// Usage
funnels.quoteWorkflow.step1_requested();
```

**Analysis in GoatCounter:**
- Filter by path prefix: `/funnel/quote/`
- Compare counts at each step
- Calculate drop-off rates

---

## Implementation Checklist

### For Each Project Instance

**Phase 1: Basic Setup (2-5 minutes)**
- [ ] Add GoatCounter script to main HTML/layout
- [ ] Verify pageview tracking in GoatCounter dashboard
- [ ] Test in development (optional: use environment flag)
- [ ] Commit and deploy

**Phase 2: Event Tracking (15-30 minutes)**
- [ ] Create analytics helper module
- [ ] Identify 5-10 key events to track
- [ ] Implement event tracking in components/functions
- [ ] Add TypeScript types (if applicable)
- [ ] Test events in GoatCounter dashboard
- [ ] Document tracked events in CLAUDE.md

**Phase 3: Funnel Tracking (1-2 hours, optional)**
- [ ] Map multi-step user workflows
- [ ] Implement funnel tracking at each step
- [ ] Create dashboard view in GoatCounter
- [ ] Set up conversion goals
- [ ] Document funnels in CLAUDE.md

---

## Project Status

| Project | Level 1 (Pageviews) | Level 2 (Events) | Level 3 (Funnels) | Priority |
|---------|---------------------|------------------|-------------------|----------|
| **windowcards** | ✅ COMPLETE | 🔲 TODO | N/A | Medium |
| **landingpage** | 🔲 TODO | 🔲 TODO | N/A | High |
| **pipetgo** | 🔲 TODO | 🔲 TODO | 🔲 TODO | High |
| **parkboard** | 🔲 TODO | 🔲 TODO | 🔲 TODO | High |
| **carpool-app** | 🔲 TODO | 🔲 TODO | N/A | Medium |
| **wareztycoon** | 🔲 TODO | N/A | N/A | Low (not started) |

---

## Standard Prompt for Project Instances

**Use this prompt when instructing project-specific Claude instances:**

---

### 📊 GoatCounter Analytics Integration Task

**Objective:** Integrate GoatCounter analytics for usage tracking and user behavior insights.

**Reference Document:** `/home/ltpt420/repos/claude-config/coordination/standards/goatcounter-integration-standard.md`

**Tasks:**

**1. Level 1: Basic Pageview Tracking (REQUIRED - 2 minutes)**
   - Add GoatCounter script to main layout/HTML
   - Account: `https://ithinkandicode.goatcounter.com/count`
   - Test: Verify pageviews appear in GoatCounter dashboard
   - Commit: `feat(analytics): add GoatCounter pageview tracking`

**2. Level 2: Event Tracking (RECOMMENDED - 15-30 minutes)**
   - Create analytics helper module (see reference doc for examples)
   - Identify key events for this project (see project-specific section in reference doc)
   - Implement event tracking for 5-10 user interactions
   - Add TypeScript types if applicable
   - Test: Verify events appear in GoatCounter dashboard
   - Document tracked events in project CLAUDE.md
   - Commit: `feat(analytics): add event tracking for key user interactions`

**3. Level 3: Funnel Tracking (OPTIONAL - 1-2 hours)**
   - Only for B2B/SaaS projects with multi-step workflows
   - Map user journeys (e.g., quote request → provision → approval)
   - Implement funnel tracking at each step
   - Document funnels in CLAUDE.md
   - Commit: `feat(analytics): add conversion funnel tracking`

**Privacy Requirements:**
- ❌ DO NOT track personal data (names, emails, IDs)
- ❌ DO NOT track financial data (prices, payment info)
- ❌ DO NOT track sensitive content (test results, lab data)
- ✅ ONLY track anonymous usage patterns

**Quality Checklist:**
- [ ] All tests pass (`npm test` or equivalent)
- [ ] TypeScript compilation clean (if applicable)
- [ ] Events verified in GoatCounter dashboard
- [ ] Documentation updated in CLAUDE.md
- [ ] No personal/sensitive data tracked

**Estimated Time:**
- Level 1: 2 minutes
- Level 2: 15-30 minutes
- Level 3: 1-2 hours (optional)

**Questions?** Check the reference document for implementation examples specific to your project's tech stack.

---

## Testing & Verification

### How to Verify Tracking Works

**1. Check GoatCounter Dashboard:**
- Visit: https://ithinkandicode.goatcounter.com
- Look for recent pageviews/events from your project
- Filter by path to see specific pages/events

**2. Browser Console Check:**

```javascript
// In browser console after page loads
console.log(window.goatcounter); // Should show object with count() function

// Test manual event
window.goatcounter.count({
  path: '/test-event',
  title: 'Test Event',
  event: true
});
// Check GoatCounter dashboard for this event
```

**3. Network Tab:**
- Open DevTools → Network tab
- Look for requests to `gc.zgo.at` or `goatcounter.com`
- Should see requests on page load and event triggers

---

## Common Issues & Solutions

**Issue: Events not appearing in dashboard**
- **Solution:** Events can take 5-10 seconds to appear; refresh dashboard
- **Solution:** Check browser console for `goatcounter` object
- **Solution:** Verify script loaded (Network tab)

**Issue: Script blocked by ad blocker**
- **Solution:** This is expected; GoatCounter respects user privacy choices
- **Solution:** Test with ad blocker disabled or private window

**Issue: Duplicate events**
- **Solution:** Check if event tracking called multiple times
- **Solution:** Add debouncing for rapid-fire events

**Issue: TypeScript errors for `window.goatcounter`**
- **Solution:** Add type declaration (see Level 2 implementation section)

---

## Coordination Protocol

**When implementing GoatCounter:**

1. **Read this standard first** - Understand implementation levels
2. **Choose appropriate level** - Level 1 minimum, Level 2 recommended for production
3. **Implement incrementally** - Don't try to do all levels at once
4. **Test thoroughly** - Verify events in dashboard before committing
5. **Document tracked events** - Add to project CLAUDE.md
6. **Update project status** - Mark completion in table above
7. **Report to RCC** - Update project status file with analytics implementation

**Escalate to RCC if:**
- Need new event categories not covered in this doc
- Privacy concerns about tracking specific events
- Integration issues with project architecture
- Need access to GoatCounter dashboard

---

## Additional Resources

**GoatCounter Documentation:**
- Homepage: https://www.goatcounter.com/
- JavaScript API: https://www.goatcounter.com/help/js
- Events guide: https://www.goatcounter.com/help/events

**Dashboard Access:**
- URL: https://ithinkandicode.goatcounter.com
- Login: (Alfie has credentials)

---

## Version History

- **1.0 (2025-11-03):** Initial standard created
  - Defined 3 implementation levels
  - Project-specific examples for all 6 projects
  - Standard prompt for project instances
  - Testing and verification guidelines

---

**Questions or suggestions?** Escalate to RCC (Root Claude) for updates to this standard.
