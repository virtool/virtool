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

