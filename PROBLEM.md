# Plan to Migrate Sessions from Redis to PostgreSQL

## Migration Table Schema Recommendations

The current migration creates a good foundation, but I recommend adding these columns:
- `user_agent` (String): Track browser/client information
- `last_accessed_at` (DateTime): Track last activity for cleanup
- `metadata` (JSON): Store additional session data flexibly

## ✅ Phase 1: Create PostgreSQL Session Data Layer (COMPLETED)

1. **✅ Create SQLAlchemy model** (`virtool/sessions/models.py`)
   - Define SQLSession class extending Base with modern Mapped annotations
   - Map to sessions table with all fields
   - Add helper methods `is_expired()` and `to_dict()` for compatibility

2. **✅ Implement SessionData for PostgreSQL** (`virtool/sessions/data.py`)
   - Replace Redis operations with PostgreSQL queries
   - Maintain same API interface as current `virtool/users/sessions.py`
   - All methods implemented:
     - `create_anonymous()`: Insert session with type='anonymous'
     - `create_authenticated()`: Insert with type='authenticated' and hashed token
     - `create_reset()`: Insert with type='reset' and reset code
     - `get_authenticated()`: Query by id and validate token hash
     - `get_anonymous()`: Query anonymous sessions
     - `get_reset()`: Query reset sessions and validate code
     - `delete()`: Delete session by id
     - `check_session_is_authenticated()`: Check if session exists and is authenticated
     - `cleanup()`: Delete expired sessions from database

## ✅ Phase 2: Update Data Layer Initialization (COMPLETED)

3. **✅ Modify data layer creation** (`virtool/data/layer.py`)
   - Changed SessionData initialization from `SessionData(redis)` to `SessionData(pg)`
   - Updated import from `virtool.users.sessions` to `virtool.sessions.data`

## ✅ Phase 3: Add Session Cleanup (COMPLETED)

4. **✅ Create cleanup task** (`virtool/sessions/tasks.py`)
   - Created SessionCleanupTask extending BaseTask
   - Runs every 5 minutes via TaskSpawnerService
   - Calls `sessions.cleanup()` to delete expired sessions

5. **✅ Update startup** (`virtool/tasks/startup.py`)
   - Added SessionCleanupTask to task spawner with 300s interval

6. **✅ Update WebSocket server** (`virtool/ws/server.py`)
   - Modified to use PostgreSQL session data layer instead of Redis
   - Updated constructor to accept full data layer
   - Kept WebSocket connection cleanup to close connections with expired sessions

## 🔲 Phase 4: Handle Session Expiration (REMAINING)

7. **Update middleware** (`virtool/api/sessions.py`)
   - Check `expires_at` field when retrieving sessions
   - Return None if session is expired  
   - Auto-delete expired sessions on access

## 🔲 Phase 5: Migration and Testing (REMAINING)

8. **Update tests** (`tests/users/test_sessions.py`)
   - Replace Redis mocks with PostgreSQL fixtures
   - Test expiration logic
   - Test concurrent access patterns

9. **Add data migration script** (optional)
   - Script to migrate active Redis sessions to PostgreSQL
   - Not required since users will re-login

## Key Implementation Details

**Session ID Generation:**
- Keep same format: `session_` + 32-byte hex token
- Check uniqueness against PostgreSQL instead of Redis

**Token Storage:**
- Store hashed tokens using same `hash_key()` function
- Never store raw tokens in database

**Expiration Times:**
- Anonymous: 10 minutes (600 seconds)
- Authenticated (remember=false): 60 minutes
- Authenticated (remember=true): 30 days
- Reset: 10 minutes

**Performance Optimizations:**
- Use indexes on `expires_at`, `user_id`, and `session_type`
- Batch delete expired sessions in cleanup task
- Consider connection pooling settings

## Files to Modify

Primary files:
- `virtool/sessions/data.py` (new)
- `virtool/sessions/models.py` (new)
- `virtool/sessions/cleanup.py` (new)
- `virtool/data/layer.py`
- `virtool/api/sessions.py`
- `virtool/ws/server.py`
- `virtool/startup.py`

Test files:
- `tests/users/test_sessions.py`
- `tests/fixtures/client.py`

Remove dependencies:
- Redis connection from SessionData
- Redis-based expiration logic

## Benefits

1. **Consistency**: All session data in one database
2. **Transactions**: Session operations can be part of DB transactions
3. **Querying**: Rich SQL queries for session analytics
4. **Backup**: Sessions included in PostgreSQL backups
5. **Simplification**: Remove Redis dependency for sessions