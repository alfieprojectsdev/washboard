<!-- copied from /home/ltpt420/repos/parkboard/docs/GIT_WORKTREE_IMPLEMENTATION_GUIDE.md -->
# Git Worktree Implementation Guide for Parkboard

**Date:** 2025-10-18
**Project:** Parkboard - Parking Management System
**Purpose:** Enable efficient multi-branch development and testing

---

## Table of Contents

1. [Introduction](#introduction)
2. [Why Git Worktrees for Parkboard](#why-git-worktrees-for-parkboard)
3. [Setup Instructions](#setup-instructions)
4. [Recommended Directory Structure](#recommended-directory-structure)
5. [Common Workflows](#common-workflows)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Usage](#advanced-usage)

---

## Introduction

Git worktrees allow you to have multiple working directories attached to the same repository. Instead of switching branches and rebuilding your project each time, you can have multiple branches checked out simultaneously in different directories.

### Key Benefits

- **No build switching overhead**: Each worktree maintains its own build artifacts (`node_modules`, `.next`, etc.)
- **Parallel development**: Work on multiple features simultaneously without losing context
- **Easy testing**: Run different branches side-by-side for comparison
- **Preserve state**: Keep uncommitted changes in one branch while working on another
- **Concurrent builds**: Run dev server on one branch while building another

---

## Why Git Worktrees for Parkboard

The Parkboard project is a Next.js application with:
- Multiple active branches (main, feature/slot-edit, fix/sign-out-issues)
- Build artifacts that take time to regenerate (node_modules, .next)
- Database migrations that may differ between branches
- E2E tests that require specific environment states
- Active development across features and bug fixes

**Current Pain Points Without Worktrees:**
- Switching branches requires rebuilding Next.js
- Can't easily compare UI changes between branches
- Risk of losing uncommitted work when switching branches
- Can't run tests on one branch while developing on another

---

## Setup Instructions

### Recommended Setup: `.trees/` Hidden Folder

The simplest approach is to keep worktrees in a hidden `.trees/` folder inside your parkboard repository:

#### 1. Navigate to Your Repository

```bash
cd /home/ltpt420/repos/parkboard
```

#### 2. Create `.trees/` Directory Structure

```bash
# Create hidden .trees directory with subdirectories
mkdir -p .trees/{.scratchpads,.locks,.coordination}

# Add .trees/ to .gitignore
echo "" >> .gitignore
echo "# Git worktrees" >> .gitignore
echo ".trees/" >> .gitignore
```

#### 3. Create Worktrees for Active Branches

```bash
# From parkboard directory
cd /home/ltpt420/repos/parkboard

# Create worktree for feature/slot-edit
git worktree add .trees/feature-slot-edit feature/slot-edit
cd .trees/feature-slot-edit
npm install
cp ../../.env.local .env.local

# Create worktree for fix/sign-out-issues
cd /home/ltpt420/repos/parkboard
git worktree add .trees/fix-sign-out-issues fix/sign-out-issues
cd .trees/fix-sign-out-issues
npm install
cp ../../.env.local .env.local

# Create worktree for development/testing
cd /home/ltpt420/repos/parkboard
git worktree add .trees/dev main
cd .trees/dev
npm install
cp ../../.env.local .env.local

# Create worktree for E2E testing
cd /home/ltpt420/repos/parkboard
git worktree add .trees/test main
cd .trees/test
npm install
cp ../../.env.local .env.local
```

**Note:** Your main branch stays in the parkboard root directory. You're already working in it!

---

## Recommended Directory Structure

### `.trees/` Hidden Folder Approach (Recommended)

```
/home/ltpt420/repos/parkboard/     # Main repository (main branch)
├── .git/                          # Git repository
├── .gitignore                     # Add .trees/ to this
│
├── .trees/                        # 🆕 Hidden worktrees folder
│   ├── .scratchpads/             # Instance communication
│   │   ├── claude-main.md        # (main is parkboard/ itself)
│   │   ├── claude-feature.md
│   │   ├── claude-fix.md
│   │   ├── claude-dev.md
│   │   ├── claude-test.md
│   │   └── shared.md
│   ├── .locks/                   # Resource locks
│   ├── .coordination/            # Task boards, priority queues
│   │
│   ├── feature-slot-edit/        # Feature branch worktree
│   │   ├── .git                  # (worktree git link)
│   │   ├── app/
│   │   ├── components/
│   │   ├── node_modules/
│   │   ├── .next/
│   │   └── ...
│   │
│   ├── fix-sign-out-issues/      # Bug fix worktree
│   │   ├── app/
│   │   ├── components/
│   │   ├── node_modules/
│   │   └── ...
│   │
│   ├── dev/                      # Dev/testing worktree
│   │   └── ...
│   │
│   └── test/                     # E2E testing worktree
│       └── ...
│
├── app/                          # Main branch files (root directory)
├── components/
├── docs/
├── node_modules/
├── .next/
└── ... (all parkboard project files)
```

**Key Points:**
- Main branch lives in `parkboard/` root (port 3000)
- Other branches live in `parkboard/.trees/<branch-name>/` (ports 3001+)
- `.trees/` is hidden (won't clutter `ls` output)
- `.trees/` is gitignored (won't be committed)
- Everything self-contained in one directory

---

## Common Workflows

### Workflow 1: Feature Development

```bash
# Create a new feature branch and worktree
cd /home/ltpt420/repos/parkboard
git worktree add .trees/feature-new-booking feature/new-booking

# Set up the new worktree
cd .trees/feature-new-booking
npm install
cp ../../.env.local .env.local

# Start development
npm run dev -- -p 3001  # Use different port to avoid conflicts

# When done, commit and push
git add .
git commit -m "feat: implement new booking feature"
git push -u origin feature/new-booking
```

### Workflow 2: Bug Fix While Developing

```bash
# You're working on feature-slot-edit when a critical bug is reported

# No need to stash! Just switch to fix worktree
cd /home/ltpt420/repos/parkboard/.trees/fix-sign-out-issues

# Create a new branch from main
git checkout -b hotfix/critical-auth-issue

# Fix the bug, test, commit
git add .
git commit -m "fix: resolve critical auth issue"
git push -u origin hotfix/critical-auth-issue

# Go back to feature work - everything is still there
cd ../feature-slot-edit
npm run dev  # Continue where you left off
```

### Workflow 3: Testing Across Branches

```bash
# Run main branch in one terminal
cd /home/ltpt420/repos/parkboard
npm run dev -- -p 3000

# Run feature branch in another terminal
cd /home/ltpt420/repos/parkboard/.trees/feature-slot-edit
npm run dev -- -p 3001

# Now you can compare both versions side-by-side in your browser
# localhost:3000 - main branch
# localhost:3001 - feature branch
```

### Workflow 4: E2E Testing

```bash
# Use the 'test' worktree for running tests
cd /home/ltpt420/repos/parkboard/.trees/test

# Pull latest changes from a specific branch
git checkout feature/slot-edit
git pull

# Run E2E tests without affecting your development environment
npm run test:e2e

# Switch back to development
cd ../feature-slot-edit
```

### Workflow 5: Database Migration Testing

```bash
# Test migrations on a separate worktree to avoid breaking your dev environment
cd /home/ltpt420/repos/parkboard/.trees/dev

# Check out the branch with new migrations
git checkout feature/slot-edit

# Run migrations
npm run db:migrate

# Test the changes
npm run dev -- -p 3003

# If something breaks, your main dev environment is unaffected
```

---

## Best Practices

### 1. Port Management

Each worktree running a dev server needs a unique port:

```bash
# main worktree
npm run dev -- -p 3000

# feature-slot-edit worktree
npm run dev -- -p 3001

# fix-sign-out-issues worktree
npm run dev -- -p 3002
```

Consider creating port aliases in each worktree's `package.json`:

```json
{
  "scripts": {
    "dev:main": "next dev -p 3000",
    "dev:feature": "next dev -p 3001",
    "dev:fix": "next dev -p 3002"
  }
}
```

### 2. Environment Variables

Copy `.env.local` from the main directory to each worktree:

```bash
# From parkboard root, copy to worktrees
cp .env.local .trees/feature-slot-edit/.env.local
cp .env.local .trees/fix-sign-out-issues/.env.local
cp .env.local .trees/dev/.env.local
cp .env.local .trees/test/.env.local
```

### 3. Database Isolation

Consider using different database instances or schemas per worktree:

```bash
# In feature-slot-edit/.env.local
DATABASE_URL="postgresql://user:pass@localhost:5432/parkboard_feature_slot_edit"

# In fix-sign-out-issues/.env.local
DATABASE_URL="postgresql://user:pass@localhost:5432/parkboard_fix_sign_out"
```

### 4. Node Modules Management

Each worktree maintains its own `node_modules`:

- **Pros**: Each branch has the exact dependencies it needs
- **Cons**: Takes more disk space

To save space, you can use symlinks for stable dependencies (advanced):

```bash
# Create a shared node_modules (use with caution)
mkdir /home/ltpt420/repos/parkboard-shared-modules
npm install --prefix /home/ltpt420/repos/parkboard-shared-modules

# Symlink in worktrees (only if package.json is identical)
# Not recommended for active development
```

### 5. Build Artifacts

Add to `.gitignore` if not already present:

```gitignore
# Build artifacts
.next/
node_modules/
.env.local
test-results/
playwright-report/
*.tsbuildinfo

# Git worktrees
.trees/
```

### 6. Naming Conventions

Use consistent naming for worktrees:

- `main` - Production/stable branch
- `feature-<name>` - Feature branches (use hyphens instead of slashes)
- `fix-<name>` - Bug fix branches
- `hotfix-<name>` - Critical fixes
- `dev` - General development/testing worktree

### 7. Cleanup

Regularly clean up worktrees you're no longer using:

```bash
# List all worktrees
git worktree list

# Remove a worktree
git worktree remove feature-slot-edit

# Or remove and delete the branch
git worktree remove feature-slot-edit
git branch -D feature/slot-edit
```

### 8. Shared Git Objects

All worktrees share the same `.git` repository, so:

- Commits in one worktree are immediately visible in others
- Fetching in one worktree updates all worktrees
- Only one worktree can have a branch checked out at a time

---

## Troubleshooting

### Issue 1: "Branch is already checked out"

```bash
# Error
fatal: 'feature/slot-edit' is already checked out at '/path/to/other/worktree'

# Solution: Remove the old worktree first
git worktree remove /path/to/other/worktree
```

### Issue 2: Port Already in Use

```bash
# Error
Error: listen EADDRINUSE: address already in use :::3000

# Solution: Use a different port or kill the existing process
lsof -ti:3000 | xargs kill -9
# Or use a different port
npm run dev -- -p 3001
```

### Issue 3: Database Connection Issues

```bash
# Different worktrees trying to use the same database
# Solution: Use different databases or ensure only one is running migrations

# Check which worktree is using the database
ps aux | grep next

# Or use separate databases per worktree
```

### Issue 4: Stale Worktree References

```bash
# Manually deleted worktree directory but git still references it
# Error: worktree path '/path/to/worktree' not found

# Solution: Prune stale references
git worktree prune
```

### Issue 5: Node Modules Mismatch

```bash
# Different branches have different dependencies
# Solution: Always run npm install after switching or pulling

cd /home/ltpt420/repos/parkboard-worktrees/feature-slot-edit
git pull
npm install  # Always reinstall after pulling
```

---

## Advanced Usage

### Automated Worktree Setup Script

Create a script to automate worktree creation:

```bash
#!/bin/bash
# save as: /home/ltpt420/repos/create-worktree.sh

BRANCH_NAME=$1
WORKTREE_NAME=$(echo $BRANCH_NAME | sed 's/\//-/g')
BARE_REPO="/home/ltpt420/repos/parkboard-bare"
WORKTREE_DIR="/home/ltpt420/repos/parkboard-worktrees/$WORKTREE_NAME"

if [ -z "$BRANCH_NAME" ]; then
  echo "Usage: ./create-worktree.sh <branch-name>"
  exit 1
fi

echo "Creating worktree for branch: $BRANCH_NAME"

# Create worktree
git -C $BARE_REPO worktree add $WORKTREE_DIR $BRANCH_NAME

# Navigate to worktree
cd $WORKTREE_DIR

# Install dependencies
echo "Installing dependencies..."
npm install

# Copy environment file
if [ -f "/home/ltpt420/repos/parkboard-worktrees/main/.env.local" ]; then
  cp /home/ltpt420/repos/parkboard-worktrees/main/.env.local .env.local
  echo "Copied .env.local"
fi

echo "Worktree created at: $WORKTREE_DIR"
echo "Next steps:"
echo "  cd $WORKTREE_DIR"
echo "  npm run dev -- -p <port>"
```

Usage:

```bash
chmod +x /home/ltpt420/repos/create-worktree.sh
./create-worktree.sh feature/new-feature
```

### Listing Worktrees with Status

```bash
# See all worktrees and their branches
git worktree list

# Example output:
# /home/ltpt420/repos/parkboard-worktrees/main              main
# /home/ltpt420/repos/parkboard-worktrees/feature-slot-edit feature/slot-edit
# /home/ltpt420/repos/parkboard-worktrees/fix-sign-out-issues fix/sign-out-issues
```

### Syncing Worktrees

```bash
# Fetch updates for all worktrees at once
git fetch --all

# Update all worktrees (run from bare repo or any worktree)
for worktree in /home/ltpt420/repos/parkboard-worktrees/*; do
  echo "Updating $worktree"
  cd $worktree
  git pull
  npm install
done
```

---

## Migration Plan from Current Setup

### Phase 1: Preparation (Estimated: 5 minutes)

1. **Commit or stash any uncommitted work**
   ```bash
   cd /home/ltpt420/repos/parkboard
   git status
   git stash push -m "Pre-worktree migration"
   ```

2. **Ensure you're on main branch**
   ```bash
   git checkout main
   git pull origin main
   ```

### Phase 2: Create `.trees/` Structure (Estimated: 2 minutes)

```bash
cd /home/ltpt420/repos/parkboard

# Create .trees directory with subdirectories
mkdir -p .trees/{.scratchpads,.locks,.coordination}

# Add .trees/ to .gitignore
echo "" >> .gitignore
echo "# Git worktrees" >> .gitignore
echo ".trees/" >> .gitignore
```

### Phase 3: Create Worktrees (Estimated: 20 minutes)

```bash
cd /home/ltpt420/repos/parkboard

# Feature branch
git worktree add .trees/feature-slot-edit feature/slot-edit
cd .trees/feature-slot-edit
npm install
cp ../../.env.local .env.local

# Fix branch
cd /home/ltpt420/repos/parkboard
git worktree add .trees/fix-sign-out-issues fix/sign-out-issues
cd .trees/fix-sign-out-issues
npm install
cp ../../.env.local .env.local

# Dev worktree
cd /home/ltpt420/repos/parkboard
git worktree add .trees/dev main
cd .trees/dev
npm install
cp ../../.env.local .env.local

# Test worktree
cd /home/ltpt420/repos/parkboard
git worktree add .trees/test main
cd .trees/test
npm install
cp ../../.env.local .env.local
```

### Phase 4: Verification (Estimated: 3 minutes)

```bash
# Verify all worktrees
cd /home/ltpt420/repos/parkboard
git worktree list

# Test main branch (already set up)
npm run build

# Test a worktree
cd .trees/feature-slot-edit
npm run build
```

### Phase 5: Optional - Set Up Coordination Infrastructure (Estimated: 5 minutes)

```bash
cd /home/ltpt420/repos/parkboard

# Use quickstart script to auto-generate scratchpads and helper scripts
./docs/scripts/quickstart-worktrees.sh
```

**Total Estimated Time: 30-35 minutes** (vs 2-3 hours for bare repository approach)

---

## Quick Reference Commands

```bash
# List all worktrees
git worktree list

# Add a new worktree
git worktree add <path> <branch>

# Add a new worktree and create a new branch
git worktree add <path> -b <new-branch>

# Remove a worktree
git worktree remove <path>

# Clean up stale worktree references
git worktree prune

# Move a worktree
git worktree move <source> <destination>

# Lock a worktree (prevent it from being pruned)
git worktree lock <path>

# Unlock a worktree
git worktree unlock <path>
```

---

## Conclusion

Git worktrees provide a powerful solution for managing multiple branches in the Parkboard project. By following this implementation guide, you can:

- Eliminate context switching overhead
- Run multiple versions simultaneously
- Test and compare changes efficiently
- Maintain separate build states

The initial setup requires some time investment, but the productivity gains and reduced friction in daily development make it worthwhile for a complex Next.js application like Parkboard.

---

## Additional Resources

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Parkboard Project README](../README.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE_20251012.md)
- [Testing Guide](./E2E_TEST_PLAN_20251012.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-18
**Maintained By:** Development Team
