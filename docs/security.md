# Security Foundation

## Authentication

Implemented foundation decisions:

- email/password first
- OAuth-ready boundary
- Argon2id password hashing requirement
- access token + refresh token architecture
- refresh token rotation support
- revocation capability

## Authorization

Roles:

- USER
- CONTRIBUTOR
- TRUSTED_CONTRIBUTOR
- MODERATOR
- ADMIN
- SUPER_ADMIN

Authorization uses RBAC with permission checks instead of hard-coded route checks.

## Operational Security

- no secrets committed
- environment based configuration
- upload validation
- audit trail for sensitive actions
- rate limiting hooks
- ownership checks

## Phase 3 outcome

Auth and RBAC boundaries are defined before implementing business APIs.
