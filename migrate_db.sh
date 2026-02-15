
#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting Database Migration..."

# URL Encoded Password: "NewlandBobby1983@@" -> "NewlandBobby1983%40%40"
# We must encode special characters like '@' because they are separators in the connection URL.
DB_PASSWORD="NewlandBobby1983%40%40"

OLD_DB_URL="postgresql://postgres:${DB_PASSWORD}@db.rdhsqobxynkilglrclks.supabase.co:5432/postgres"
NEW_DB_URL="postgresql://postgres:${DB_PASSWORD}@db.ksbfcjpwdnbvowloqoeg.supabase.co:5432/postgres"

echo "1. Dumping OLD Database (Schema + Data + Auth)..."
pg_dump "$OLD_DB_URL" \
  --clean \
  --if-exists \
  --quote-all-identifiers \
  --exclude-schema=extensions \
  --exclude-schema=vault \
  --exclude-schema=storage \
  --exclude-schema=graphql \
  --exclude-schema=graphql_public \
  --no-owner \
  --no-privileges \
  --file=migration_backup.sql

echo "✅ Dump Complete: migration_backup.sql"

echo "2. Restoring to NEW Database..."
psql "$NEW_DB_URL" -f migration_backup.sql

echo "🎉 Migration Complete!"
