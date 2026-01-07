# Real-Time Queue Updates Implementation Plan

**Document Version:** 1.0
**Date:** 2025-01-07
**Status:** Planning Phase
**Project:** Washboard Car Wash Queue Management
**Feature:** Polling-Based Real-Time Queue Position Updates

---

## Executive Summary

### Goal
Enable customers to see live queue position updates on the booking confirmation page without manual refresh, improving transparency and reducing customer anxiety.

### Approach
Implement lightweight polling-based real-time updates using a new public API endpoint that returns current queue status. Customer-facing page polls every 10 seconds to update position, estimated wait time, and booking status.

### Key Benefits
1. **Customer Experience**: Reduces anxiety through transparency ("I was #7, now I'm #4!")
2. **Operational Efficiency**: Customers arrive at the right time (fewer early/late arrivals)
3. **Reduced Support Load**: Fewer "where am I in line?" calls to receptionist
4. **Competitive Advantage**: Modern, tech-forward experience

### Implementation Effort
- **Complexity**: Medium
- **Estimated Time**: 4-6 hours of development + testing
- **Risk Level**: Low (additive feature, no breaking changes)
- **Performance Impact**: Minimal (~60 requests/minute with 10 concurrent bookings)

---

## Architecture Overview

### Current State (Static)
```
Customer books → Redirected to success page with position from URL
                 ↓
           Static display: "Position #7"
           (Never updates until manual refresh)
```

### Desired State (Real-Time)
```
Customer books → Success page with initial position
                 ↓
           JavaScript polls /api/bookings/:id/status every 10s
                 ↓
           UI updates: Position, status, estimated wait time
                 ↓
           Stops polling when: cancelled, completed, in_service
```

### Technology Stack
- **Backend**: Next.js API Route (serverless function)
- **Frontend**: React with useEffect polling hook
- **Database**: PostgreSQL (existing schema, no changes needed)
- **Performance**: 10-second polling interval (not aggressive)

---

## Phase 1: API Endpoint Creation

### 1.1 Create Status API Route

**File**: `/home/finch/repos/washboard/washboard-app/src/app/api/bookings/[id]/status/route.ts`

**Requirements**:
- Public endpoint (no authentication required - customer-facing)
- Returns current queue position, status, and estimated wait time
- Handles edge cases: booking not found, invalid ID, non-queued statuses
- Performance: Single indexed query (fast response < 100ms)

**API Contract**:

**Request**:
```
GET /api/bookings/:id/status
```

**Response (Queued)**:
```json
{
  "status": "queued",
  "position": 5,
  "inService": false,
  "estimatedWaitMinutes": 80,
  "queuedAt": "2025-01-07T10:30:00Z"
}
```

**Response (In Service)**:
```json
{
  "status": "in_service",
  "position": null,
  "inService": true,
  "estimatedWaitMinutes": 0
}
```

**Response (Completed/Cancelled)**:
```json
{
  "status": "done",
  "position": null,
  "inService": false,
  "completed": true
}
```

**Error Responses**:
- `400 Bad Request`: Invalid booking ID format
- `404 Not Found`: Booking doesn't exist
- `500 Internal Server Error`: Database/server error

**Implementation Details**:
- Query booking by ID with current position
- Calculate estimated wait: `(position - 1) * avg_service_minutes`
- Fetch `avg_service_minutes` from branches table
- Return null position for non-queued statuses (done, cancelled)
- Include status flags for easy UI branching

**Database Query** (indexed, fast):
```sql
SELECT
  id,
  status,
  position,
  branch_code,
  created_at
FROM bookings
WHERE id = $1
```

**Validation Rules**:
- Booking ID must be positive integer
- Handle missing/deleted bookings gracefully
- No sensitive data exposure (only public booking info)

---

## Phase 2: Frontend Polling Implementation

### 2.1 Update Booking Success Page Component

**File**: `/home/finch/repos/washboard/washboard-app/src/app/book/success/page.tsx`

**Changes**:
1. Add state management for real-time queue status
2. Implement polling logic with useEffect
3. Add cleanup to prevent memory leaks
4. Handle all status transitions (queued → in_service → done)
5. Stop polling when booking reaches terminal state

**State Structure**:
```typescript
interface QueueStatus {
  status: 'queued' | 'in_service' | 'done' | 'cancelled';
  position: number | null;
  inService: boolean;
  completed?: boolean;
  cancelled?: boolean;
  estimatedWaitMinutes?: number;
}
```

**Polling Logic**:
```typescript
useEffect(() => {
  if (!bookingId || !isPolling) return;

  const pollInterval = setInterval(async () => {
    const response = await fetch(`/api/bookings/${bookingId}/status`);
    if (response.ok) {
      const data = await response.json();
      setQueueStatus(data);

      // Stop polling for terminal states
      if (data.completed || data.cancelled || data.inService) {
        setIsPolling(false);
      }
    }
  }, 10000); // Poll every 10 seconds

  return () => clearInterval(pollInterval); // Cleanup
}, [bookingId, isPolling]);
```

**Performance Considerations**:
- Poll interval: 10 seconds (not too aggressive)
- Automatic cleanup on component unmount
- Stop polling when no longer needed
- Lightweight API response (< 1KB)

---

## Phase 3: UI/UX Enhancements

### 3.1 Visual Indicators for Live Updates

**Changes**:
1. Add pulsing green dot next to "Queue Position" label
2. Show "Auto-updating every 10 seconds" text with spinning icon
3. Smooth transitions when position changes (CSS animations)
4. Clear visual feedback for each state

**Visual Elements**:
```tsx
{/* Live indicator dot */}
<span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"
      title="Live updates"></span>

{/* Auto-update text */}
<div className="flex items-center gap-2 text-sm text-gray-600">
  <svg className="w-4 h-4 animate-spin">...</svg>
  <span>Auto-updating every 10 seconds</span>
</div>
```

### 3.2 State-Specific UI Screens

**Queued State** (Active):
- Display current position with live updates
- Show estimated wait time
- Display "What Happens Next?" instructions
- Keep page in active polling mode

**In Service State**:
- Large animated icon (pulsing blue lightning bolt)
- "Your Turn!" headline
- "Please proceed to the wash area" message
- Stop polling (no more updates needed)

**Completed State**:
- Green checkmark icon
- "Service Complete!" headline
- "Thank you for using our service" message
- Stop polling

**Cancelled State**:
- Red X icon
- "Booking Cancelled" headline
- "Your booking has been cancelled by the receptionist" message
- Stop polling

### 3.3 Position Change Notifications

**Behavior**:
- Track last known position
- When position improves by 2+ spots → console.log (could add browser notification)
- When position reaches #1 → "Next in line!" message
- Smooth number transitions (not jarring jumps)

---

## Phase 4: Error Handling & Edge Cases

### 4.1 Network Error Handling

**Scenarios**:
1. API endpoint unreachable → Continue polling, log error silently
2. Malformed JSON response → Show error state, stop polling
3. 404 Booking Not Found → Show "Booking not found" error
4. 500 Server Error → Retry once, then show error

**Implementation**:
```typescript
try {
  const response = await fetch(`/api/bookings/${bookingId}/status`);
  if (response.ok) {
    // Success path
  } else if (response.status === 404) {
    setError('Booking not found');
    setIsPolling(false);
  }
} catch (error) {
  console.error('Failed to fetch queue status:', error);
  // Continue polling (network might recover)
}
```

### 4.2 Edge Cases

**Receptionist Actions**:
- Booking cancelled → Show cancelled state, stop polling
- Booking moved to in_service → Show "Your Turn!" screen
- Position reordered → Update position smoothly

**Customer Navigation**:
- User leaves page → Cleanup polling via useEffect cleanup
- User returns to page → Resume polling from current state
- Page refresh → Reset to initial state (from URL params)

**Data Consistency**:
- Position jumps backward (rare) → Show updated position without notification
- Estimated wait time increases → Update display
- Status changes unexpectedly → Handle gracefully

---

## Phase 5: Testing Strategy

### 5.1 Unit Tests

**API Endpoint Tests** (`src/__tests__/api/booking-status.test.ts`):
```typescript
describe('GET /api/bookings/:id/status', () => {
  it('should return current queue position for queued booking', async () => {
    // Create test booking with position 3
    // Call API endpoint
    // Verify: status=queued, position=3, estimatedWaitMinutes calculated
  });

  it('should return in_service status when booking is being serviced', async () => {
    // Create booking with status=in_service
    // Call API endpoint
    // Verify: status=in_service, position=null, inService=true
  });

  it('should return 404 for non-existent booking', async () => {
    // Call API with invalid ID
    // Verify: 404 status code
  });

  it('should calculate estimated wait time correctly', async () => {
    // Create booking at position 5
    // Branch has avg_service_minutes = 20
    // Verify: estimatedWaitMinutes = 80 (4 * 20)
  });
});
```

**Frontend Polling Tests** (`src/__tests__/components/booking-success.test.ts`):
```typescript
describe('BookingSuccessPage polling', () => {
  it('should poll for status updates every 10 seconds', async () => {
    // Mock fetch
    // Render component
    // Advance timers by 10s
    // Verify: fetch called
  });

  it('should stop polling when booking is completed', async () => {
    // Mock fetch returning completed=true
    // Render component
    // Advance timers
    // Verify: no more fetch calls
  });

  it('should update UI when position changes', async () => {
    // Mock fetch returning position 5, then position 3
    // Render component
    // Advance timers
    // Verify: UI shows position 3
  });
});
```

### 5.2 Integration Testing

**Manual Testing Checklist**:
- [ ] Create booking via magic link
- [ ] Verify success page shows initial position
- [ ] Open receptionist dashboard
- [ ] Move booking position (drag-and-drop or PATCH API)
- [ ] Verify success page updates within 10 seconds
- [ ] Mark booking as in_service in dashboard
- [ ] Verify success page shows "Your Turn!" screen
- [ ] Mark booking as done in dashboard
- [ ] Verify success page shows "Service Complete!" screen
- [ ] Cancel booking in dashboard
- [ ] Verify success page shows "Booking Cancelled" screen

**Performance Testing**:
- [ ] Monitor API response time (should be < 100ms)
- [ ] Test with 10 concurrent polling pages
- [ ] Verify database query uses index (EXPLAIN ANALYZE)
- [ ] Check for memory leaks (component unmount cleanup)

### 5.3 E2E Tests (Playwright)

**Test Scenarios**:
```typescript
test('customer sees live queue position updates', async ({ page }) => {
  // 1. Create booking via API
  // 2. Navigate to success page
  // 3. Verify initial position displayed
  // 4. Update booking position via API
  // 5. Wait 10 seconds
  // 6. Verify new position displayed
});

test('polling stops when booking is completed', async ({ page }) => {
  // 1. Create booking
  // 2. Navigate to success page
  // 3. Intercept fetch requests
  // 4. Mark booking as done via API
  // 5. Wait 20 seconds
  // 6. Verify no more fetch requests
});
```

---

## Phase 6: Documentation & Deployment

### 6.1 API Documentation

**Update**: `/home/finch/repos/washboard/washboard-app/src/app/api/bookings/[id]/status/route.ts`

Add comprehensive JSDoc comments:
```typescript
/**
 * GET /api/bookings/:id/status
 *
 * Public endpoint - returns current queue position and status for a booking.
 * No authentication required (customer-facing).
 *
 * @param id - Booking ID (integer)
 * @returns {QueueStatus} Current queue status with position and estimated wait
 *
 * @example
 * GET /api/bookings/123/status
 * Response: { "status": "queued", "position": 5, "estimatedWaitMinutes": 80 }
 *
 * Performance: Single indexed query, < 100ms response time
 * Polling: Designed for 10-second polling intervals
 */
```

### 6.2 User Documentation

**Update**: `/home/finch/repos/washboard/README.md`

Add section under "Features":
```markdown
- **Live Queue Updates**
  - Customer booking confirmation page auto-updates every 10 seconds
  - See real-time position changes as queue moves
  - Automatic status transitions (queued → in service → completed)
  - Reduces customer anxiety with transparent wait time estimates
```

### 6.3 CLAUDE.md Updates

**Update**: `/home/finch/repos/washboard/CLAUDE.md`

Add section under "Architecture":
```markdown
### Real-Time Queue Updates

Customer-facing booking confirmation page uses lightweight polling:
- Polls `/api/bookings/:id/status` every 10 seconds
- Updates position, status, and estimated wait time
- Stops polling when booking reaches terminal state
- No WebSockets/SSE needed (serverless-compatible)

**Performance**: ~60 requests/minute with 10 concurrent active bookings
```

### 6.4 Deployment Checklist

**Pre-Deployment**:
- [ ] All unit tests passing (100%)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Performance benchmarks met (< 100ms API response)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Code review completed
- [ ] Documentation updated

**Post-Deployment Verification**:
- [ ] Create test booking in production
- [ ] Verify success page loads
- [ ] Verify polling starts automatically
- [ ] Move booking in dashboard
- [ ] Verify success page updates within 10 seconds
- [ ] Check server logs for errors
- [ ] Monitor API response times (CloudWatch/Vercel Analytics)

---

## Performance Analysis

### API Load Estimation

**Assumptions**:
- Average booking session: 20-30 minutes (from queue to completion)
- Polling interval: 10 seconds
- Requests per booking: 120-180 total

**Scenario: 10 Concurrent Bookings**:
- 10 bookings × 6 requests/minute = **60 requests/minute**
- **1 request/second** average load
- Database: Simple indexed SELECT (< 10ms)
- API Route: Minimal processing (< 100ms total)

**Verdict**: Very manageable for serverless Next.js + PostgreSQL

### Database Query Performance

**Query**:
```sql
SELECT id, status, position, branch_code, created_at
FROM bookings
WHERE id = $1
```

**Index Used**: Primary key (id) - O(log n) lookup

**Estimated Performance**:
- Table size: 1,000 bookings → < 5ms
- Table size: 10,000 bookings → < 10ms
- Table size: 100,000 bookings → < 20ms

**Optimization**: No additional indexes needed (primary key sufficient)

### Frontend Performance

**Component Rendering**:
- State updates trigger re-render
- Only affected components re-render (position, status)
- Smooth CSS transitions (GPU-accelerated)

**Memory Usage**:
- Single polling interval per page
- Cleanup on unmount prevents leaks
- Minimal state (< 1KB per component)

---

## Security Considerations

### Public API Endpoint

**Threat Model**:
- ❌ No authentication required (by design - customer-facing)
- ✅ No sensitive data exposed (only public booking info)
- ✅ Rate limiting NOT needed (read-only, minimal load)
- ✅ SQL injection prevented (parameterized queries)

**Data Exposure**:
```json
{
  "status": "queued",      // Public info
  "position": 5,           // Public info
  "estimatedWaitMinutes": 80  // Calculated, not sensitive
}
```

**Not Exposed**:
- Customer name, phone, vehicle details
- Magic link tokens
- Receptionist information
- Branch-specific data

### Input Validation

**Booking ID**:
- Must be positive integer
- Convert to number, check `isNaN()`
- Return 400 for invalid format
- Return 404 for non-existent ID

**No User Input Beyond ID**:
- No query parameters
- No request body
- No risk of injection attacks

---

## Alternative Approaches (Not Recommended)

### WebSockets

**Pros**: True real-time, instant updates
**Cons**:
- Complex infrastructure (persistent connections)
- Not serverless-friendly (Vercel limits)
- Overkill for 10-second updates
- Higher cost and complexity

**Verdict**: ❌ Not suitable for Washboard's architecture

### Server-Sent Events (SSE)

**Pros**: One-way server push, simpler than WebSockets
**Cons**:
- Similar infrastructure challenges
- Browser compatibility issues
- Connection management complexity

**Verdict**: ❌ Too complex for the benefit

### Manual Refresh Button

**Pros**: Zero complexity
**Cons**:
- Poor UX (users forget to refresh)
- Defeats purpose of real-time updates
- Increases support burden

**Verdict**: ❌ Not user-friendly

### Polling (Recommended)

**Pros**:
- Simple implementation
- Serverless-compatible
- Good enough UX (10s latency acceptable)
- Low cost and maintenance

**Cons**:
- Slight delay (10s)
- More API calls than push-based

**Verdict**: ✅ **Best fit for Washboard**

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| API performance degradation | Low | Medium | Monitor response times, add caching if needed |
| Polling interval too aggressive | Low | Low | Start with 10s, adjust based on usage |
| Memory leaks from polling | Low | Medium | Thorough testing of useEffect cleanup |
| Database query slow | Very Low | Low | Query uses primary key index |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Customer confusion with updates | Low | Low | Clear UI indicators ("Auto-updating...") |
| Increased server costs | Low | Low | Monitor usage, serverless auto-scales |
| Feature not used | Medium | Low | Analytics to track engagement |

**Overall Risk Level**: **Low**

---

## Success Metrics

### Technical Metrics

- [ ] API response time < 100ms (p95)
- [ ] Zero errors in production logs
- [ ] 100% test coverage for new code
- [ ] No memory leaks detected
- [ ] TypeScript strict mode passing

### User Experience Metrics

- [ ] Customer satisfaction survey (if available)
- [ ] Reduced "where am I?" calls to receptionist
- [ ] Time spent on confirmation page (should increase)
- [ ] Bounce rate on confirmation page (should decrease)

### Business Metrics

- [ ] Server costs remain within budget
- [ ] No customer complaints about feature
- [ ] Receptionist feedback positive
- [ ] Feature adoption rate (% of customers keeping page open)

---

## Rollback Plan

**If Issues Arise**:

1. **Disable Polling (Quick Fix)**:
   - Comment out polling logic in success page
   - Revert to static display
   - Deploy immediately (< 5 minutes)

2. **Remove API Endpoint**:
   - Delete status API route file
   - Remove from routing
   - No database changes needed (schema unchanged)

3. **Revert Commits**:
   - Identify commits via git log
   - `git revert <commit-hash>`
   - Push to trigger re-deployment

**Rollback Time**: < 15 minutes to fully revert

---

## Future Enhancements

### Phase 7 (Optional): Browser Push Notifications

**When to Implement**: After Phase 1-6 stable in production

**Features**:
- Request notification permission on booking confirmation
- Push notification when position reaches #1
- "Your turn is coming up!" alert
- Requires Web Push API integration

**Complexity**: Medium
**Value**: High (for users who bookmark page)

### Phase 8 (Optional): WebSocket Upgrade

**When to Implement**: If serverless limitations removed, or high-volume usage

**Benefits**:
- Instant updates (no 10s delay)
- Lower API call volume
- Better scalability at very high concurrency

**Complexity**: High
**Value**: Medium (marginal improvement over polling)

---

## Implementation Checklist

### Phase 1: API Endpoint
- [ ] Create `/api/bookings/[id]/status/route.ts`
- [ ] Implement GET handler with query logic
- [ ] Add error handling (400, 404, 500)
- [ ] Calculate estimated wait time
- [ ] Add JSDoc documentation
- [ ] Write unit tests (4 test cases minimum)
- [ ] Test manually with curl/Postman

### Phase 2: Frontend Polling
- [ ] Update success page component
- [ ] Add QueueStatus interface
- [ ] Implement polling with useEffect
- [ ] Add cleanup logic
- [ ] Handle all status transitions
- [ ] Add loading/error states
- [ ] Write component tests

### Phase 3: UI/UX
- [ ] Add live update indicator (pulsing dot)
- [ ] Add "Auto-updating..." text
- [ ] Implement state-specific screens (4 states)
- [ ] Add CSS animations for smooth transitions
- [ ] Test accessibility (screen readers)
- [ ] Mobile responsiveness check

### Phase 4: Testing
- [ ] Unit tests passing (100%)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Performance benchmarks met
- [ ] Manual testing checklist completed

### Phase 5: Documentation
- [ ] Update API JSDoc
- [ ] Update README.md
- [ ] Update CLAUDE.md
- [ ] Add inline code comments

### Phase 6: Deployment
- [ ] Pre-deployment checklist complete
- [ ] Deploy to production
- [ ] Post-deployment verification
- [ ] Monitor for 24 hours
- [ ] Collect initial feedback

---

## Conclusion

This plan provides a comprehensive roadmap for implementing real-time queue updates in Washboard. The polling-based approach is:

- ✅ **Simple**: Straightforward implementation, no complex infrastructure
- ✅ **Serverless-compatible**: Works with Vercel/Next.js architecture
- ✅ **Low-risk**: Additive feature, easy to rollback
- ✅ **High-value**: Significant UX improvement for customers
- ✅ **Maintainable**: Clear code, well-tested, documented

**Recommendation**: Proceed with implementation when development resources are available. Estimated timeline: **1-2 days** for development + testing + deployment.

---

**Next Steps**: Review this plan, adjust priorities, and decide on implementation timeline. When ready to proceed, use this plan to guide incremental development with proper testing and validation at each phase.
