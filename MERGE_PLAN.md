# Merge Plan for Washboard Repository
**Date:** 2025-11-13 23:47
**Session ID:** 011CUssvkMuT9Mp2edxtrEYt
**Current Branch:** `claude/onboard-repo-docs-011CUssvkMuT9Mp2edxtrEYt`

---

## Current State

### Branch Status
- **Feature Branch:** `claude/onboard-repo-docs-011CUssvkMuT9Mp2edxtrEYt`
- **Main Branch:** `main` (behind by 5 commits)
- **Relationship:** Feature branch is fast-forward from main (clean merge)

### Commits to Merge (5 Total)

```
95807d4 chore: Clean up repo for portfolio presentation
5986fa6 docs: Add comprehensive README.md for portfolio
41e89ad fix(accessibility): Improve text contrast ratios across all pages
c3ec53e debug: Add logging for magic link URL generation
aa740cb fix: Generate magic link URLs dynamically from request headers
```

### What Changed

**Functionality:**
- ✅ Magic link URLs now use production domain (not localhost)
- ✅ Accessibility improvements (text contrast WCAG 2.1 AA compliance)
- ✅ Debug logging for URL generation

**Documentation:**
- ✅ Comprehensive README.md for portfolio
- ✅ Code review findings (RECOMMENDATIONS file)
- ❌ Removed CLAUDE.md and 7 planning docs (cleaned for portfolio)
- ❌ Removed .claude/ folder (internal tooling)

**Security:**
- ✅ Enhanced .gitignore (repo root + washboard-app)
- ✅ .env.example uses placeholders
- ✅ No secrets in tracked files

---

## Merge Strategy (When Using Teleport)

### Option 1: Fast-Forward Merge (RECOMMENDED)

**Advantages:**
- Clean linear history
- No merge commit clutter
- All commits attributed correctly

**Steps:**
```bash
cd ~/repos/washboard

# Ensure we're on main
git checkout main

# Pull latest changes from remote
git pull origin main

# Fast-forward merge (no merge commit)
git merge --ff-only claude/onboard-repo-docs-011CUssvkMuT9Mp2edxtrEYt

# Verify
git log --oneline -10

# Push to main
git push origin main
```

**Expected Result:**
```
main branch will be at commit 95807d4
All 5 commits cleanly applied to main
```

---

### Option 2: Squash Merge (Alternative)

**Use If:** You want a single commit on main instead of 5

**Advantages:**
- Single commit per feature
- Cleaner main branch history
- Easier to revert if needed

**Steps:**
```bash
git checkout main
git pull origin main

# Squash merge (creates single commit)
git merge --squash claude/onboard-repo-docs-011CUssvkMuT9Mp2edxtrEYt

# Create descriptive commit
git commit -m "feat: Portfolio presentation improvements

- Add comprehensive README.md with quality metrics
- Fix magic link URLs for production deployment
- Improve accessibility (WCAG 2.1 AA text contrast)
- Clean up internal docs for public portfolio
- Add comprehensive code review (RECOMMENDATIONS file)
- Enhance .gitignore for security

Includes 5 commits:
- aa740cb: Dynamic magic link URL generation
- c3ec53e: Magic link debug logging
- 41e89ad: Accessibility contrast fixes
- 5986fa6: Portfolio README
- 95807d4: Repo cleanup

Session: 011CUssvkMuT9Mp2edxtrEYt"

# Push
git push origin main
```

---

## Branch Cleanup (After Merge)

### Delete Feature Branch Locally
```bash
# After merging to main
git branch -d claude/onboard-repo-docs-011CUssvkMuT9Mp2edxtrEYt
```

### Delete Feature Branch Remotely
```bash
# Delete from GitHub
git push origin --delete claude/onboard-repo-docs-011CUssvkMuT9Mp2edxtrEYt
```

### Verify Cleanup
```bash
# Should only show main
git branch -a
```

---

## Pre-Merge Checklist

Before merging, verify:

- [ ] All tests passing: `cd washboard-app && npm test`
- [ ] Build succeeds: `cd washboard-app && npm run build`
- [ ] No uncommitted changes: `git status`
- [ ] Feature branch is pushed: `git push origin claude/onboard-repo-docs-011CUssvkMuT9Mp2edxtrEYt`
- [ ] Review RECOMMENDATIONS file for critical issues
- [ ] Backup created: `CLAUDE.md.backup` exists locally

---

## Post-Merge Tasks

### Immediate (After Merge to Main)

1. **Trigger Vercel Deployment**
   - Push to main will auto-deploy to Vercel
   - Monitor deployment at https://vercel.com/dashboard

2. **Verify Deployed Changes**
   - [ ] README.md visible on GitHub repository
   - [ ] Magic links use production domain (not localhost)
   - [ ] Accessibility improvements visible (darker text)

3. **Test Production**
   - [ ] Generate magic link from dashboard
   - [ ] Verify URL uses `washboard.ithinkandicode.space` domain
   - [ ] Test booking flow in incognito mode
   - [ ] Verify text contrast improvements on all pages

### High Priority (Within 1 Week)

**Fix Critical Issues from RECOMMENDATIONS File:**

1. **CRITICAL-001: sameSite Cookie** (5 minutes)
   - File: `washboard-app/src/lib/auth/session.ts:162`
   - Change `sameSite: 'strict'` to `sameSite: 'lax'`

2. **CRITICAL-002: Rate Limiting** (2-4 hours)
   - Implement Vercel KV or database-based rate limiting
   - Current in-memory solution won't work on Vercel

3. **CRITICAL-003: Shop Status Validation** (30 minutes)
   - Add check in `bookings/submit/route.ts`
   - Prevent bookings when shop is closed

4. **HIGH-001: XSS Vulnerability** (20 minutes)
   - Validate messenger URLs in `BookingsTable.tsx`

**Estimated Time:** 3-5 hours total

### Optional (Post-Launch)

- Implement refactoring recommendations (REFACTOR-001 through REFACTOR-005)
- Add Content-Security-Policy headers
- Set up automated security scanning (Snyk, Dependabot)

---

## Rollback Plan (If Needed)

### Rollback to Previous Main
```bash
# Find commit hash before merge
git log --oneline main

# Reset to previous state (replace HASH)
git reset --hard <HASH-BEFORE-MERGE>

# Force push (DANGEROUS - use with caution)
git push origin main --force
```

### Revert Specific Commits
```bash
# Revert most recent commit
git revert HEAD

# Revert specific commit
git revert 95807d4
```

---

## File References for Quick Access

**Critical Files Modified:**
- `README.md` (portfolio documentation)
- `.gitignore` (repo root - new)
- `washboard-app/.gitignore` (enhanced)
- `washboard-app/.env.example` (placeholders)

**Files Removed:**
- `CLAUDE.md` (backed up as `CLAUDE.md.backup`)
- `docs/` folder (7 planning docs removed)
- `.claude/` folder (9 agent/command files removed)

**Files Added:**
- `RECOMMENDATIONS_20251113-234245_011CUssvkMuT9Mp2edxtrEYt.md`
- `MERGE_PLAN.md` (this file)

---

## Notes for Next Session

### Environment Context
- **Working Directory:** `/home/user/washboard`
- **Git Remote:** Uses HTTP proxy on localhost (teleport environment)
- **Current User:** User with git access (not root)

### Git Aliases Available
- User has custom git aliases in local environment
- Located at: `/home/ltpt420/repos/localtools/setup-git-aliases.sh`
- Already applied in user's terminal

### Important Reminders
- `CLAUDE.md.backup` is gitignored (not in repo)
- RECOMMENDATIONS file documents 3 critical production blockers
- All tests currently pass (130/130)
- Build is successful
- Vercel deployment will auto-trigger on main push

---

## Recommended Merge Command (Copy-Paste Ready)

```bash
# Navigate to repo
cd ~/repos/washboard

# Checkout main
git checkout main

# Pull latest
git pull origin main

# Fast-forward merge
git merge --ff-only claude/onboard-repo-docs-011CUssvkMuT9Mp2edxtrEYt

# Push to trigger deployment
git push origin main

# Clean up feature branch (optional)
git push origin --delete claude/onboard-repo-docs-011CUssvkMuT9Mp2edxtrEYt
git branch -d claude/onboard-repo-docs-011CUssvkMuT9Mp2edxtrEYt

# Verify
git log --oneline -10
git branch -a
```

---

**Status:** ✅ Ready for merge
**Risk Level:** 🟢 Low (fast-forward merge, all tests passing)
**Deployment:** 🔵 Auto-deploy on push to main (Vercel)
**Next Action:** Run commands above when using `claude --teleport`
