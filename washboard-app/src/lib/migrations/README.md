# Database Migrations

## Overview
This directory contains SQL migration scripts for the Washboard database schema.

## Migration Files

- `001_initial_schema_up.sql` - Initial schema creation
- `001_initial_schema_down.sql` - Rollback initial schema

## Running Migrations

### Development (pg-mem)
Migrations are applied automatically when using mock database.

### Production (NeonDB)

**Apply migration (up)**:
```bash
psql $DATABASE_URL -f src/lib/migrations/001_initial_schema_up.sql
```

**Rollback migration (down)**:
```bash
psql $DATABASE_URL -f src/lib/migrations/001_initial_schema_down.sql
```

## Migration Naming Convention

Format: `XXX_description_[up|down].sql`
- `XXX`: Sequential number (001, 002, 003...)
- `description`: Brief description (snake_case)
- `up`: Apply changes
- `down`: Rollback changes

## Safety

- Always test migrations on development database first
- **NEVER run down migrations on production without backup**
- Down migrations will **DELETE ALL DATA**
- Use transactions (BEGIN/COMMIT) for safety

## Version Tracking

Current schema version is tracked in the `schema_version` table.
