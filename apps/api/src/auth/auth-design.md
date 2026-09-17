# Authentication Foundation

## Authentication model

Hola Maps uses:

- email/password authentication initially
- OAuth providers can be added later
- short-lived access tokens
- refresh tokens stored with rotation support

## Token model

Access token:
- API authorization
- short lifetime
- contains user id and role claims

Refresh token:
- persistent session renewal
- stored as hashed token record
- revocable
- rotated after use

## Password security

Requirements:

- Argon2id password hashing
- password strength validation
- no plaintext storage

## Session lifecycle

1. User logs in
2. Server validates password
3. Server issues access token + refresh token
4. Refresh request rotates refresh token
5. Old token is revoked
6. Suspicious reuse can invalidate session
