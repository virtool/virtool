## Business Logic Testing Plan for tests/account/test_api.py

### URGENT: Password Reset Bug Fix

**Issue**: The existing password reset functionality is broken. `TestLoginReset::test_ok` is failing with 400 status instead of 200.

#### Immediate Actions Needed:
1. **Fix reset functionality** - Debug why valid reset attempts return 400 Bad Request
2. **Investigate session state** - Check if reset sessions are properly created/maintained
3. **Verify reset code generation** - Ensure reset codes are valid and properly stored

#### Missing Security Tests:
- **test_old_password_cannot_be_reused_for_reset** - Ensure users cannot reset to their current password
- **test_reset_code_single_use** - Verify reset codes cannot be reused after successful reset
- **test_reset_invalidates_old_sessions** - Check that password reset invalidates existing sessions

### 4. **State Consistency Testing**

#### TestLogin - Add tests for

- **test_failed_login_preserves_session** - Failed login doesn't corrupt anonymous session
- **test_login_invalidates_old_session** - Previous authenticated session is cleaned up
- **test_force_reset_blocks_api_access** - Cannot use API keys during forced reset

#### TestLogout - Add test for

- **test_logout_preserves_api_keys** - API keys remain valid after logout

### 5. **Concurrent Operations**

#### New TestClass: TestConcurrentOperations

- **test_concurrent_key_creation** - Multiple simultaneous key creations handle ID conflicts
- **test_concurrent_login_sessions** - Same user logging in from multiple clients
- **test_concurrent_password_updates** - Race condition handling in password changes

### 6. **Resource Cleanup & Cascading**

#### TestClass: TestAccountDeletion (if user deletion exists)

- **test_user_deletion_removes_keys** - Deleting user removes all their API keys
- **test_user_deletion_invalidates_sessions** - Active sessions are terminated

### 7. **Rate Limiting & Security**

#### TestLogin - Add tests for

- **test_login_attempts_tracking** - Track failed login attempts (if implemented)
- **test_session_expiry** - Old sessions are properly expired
- **test_reset_code_expiry** - Reset codes have time limit

### 8. **API Key Naming & Limits**

#### TestCreateAPIKey - Add tests for

- **test_duplicate_key_names_allowed** - Same user can have multiple keys with same name
- **test_key_count_limit** - Maximum number of keys per user (if limit exists)
- **test_key_name_normalization** - How whitespace in names is handled

### Implementation Priority

1. **High Priority**: Permission boundaries, Email uniqueness, Resource ownership
2. **Medium Priority**: State consistency, Concurrent operations
3. **Low Priority**: Rate limiting, Resource limits

Each test should focus on **business rules** not input validation, using valid Pydantic data but testing application-level constraints.

# TODO: Convert test_delete_user to Class-Based Test

## Background
Similar to the `test_update_user` conversion, `test_delete_user` in `tests/references/test_api.py` needs to be converted from a parametrized test to a class-based test.

## Current Issues
1. The `test_delete_user` function is currently parametrized with error cases
2. The underlying `delete_user()` function in `virtool/references/data.py:856` has the same user ID type mismatch issue that was fixed in `update_user()`
3. The function needs to handle both string and integer user IDs during the MongoDB/PostgreSQL migration

## Tasks Required
1. **Fix the data layer function**: Update `delete_user()` in `virtool/references/data.py:856` to handle mixed user ID types:
   - Use `$or` query to match both string and integer user IDs
   - Add TODO comment about removing this once migration is complete
   - Handle comparison logic in the loop

2. **Convert test to class-based**: Follow the same pattern as `TestUpdateUser`:
   - Create `TestDeleteUser` class
   - Add `setup()` autouse fixture to create test environment
   - Create individual test methods: `test_ok`, `test_ref_not_found`, `test_user_not_found`
   - Use different URLs to test error behaviors

3. **Update snapshots**: Run tests with `--snapshot-update` to generate new snapshots

## Reference
- See `TestUpdateUser` class for the pattern to follow
- See the fixes made to `update_user()` function for the data layer changes needed
- The `delete_user()` function at line 856 has the same MongoDB query pattern that needs fixing

## Files to Modify
- `virtool/references/data.py` (fix `delete_user()` function)
- `tests/references/test_api.py` (convert test to class-based)

