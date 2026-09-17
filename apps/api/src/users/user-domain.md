# User Domain

## Core concepts

User account and public profile are separated.

Account:
- authentication identity
- email
- password credential
- security state

Profile:
- username
- display name
- avatar
- contributor information

## Roles

Supported roles:

- USER
- CONTRIBUTOR
- TRUSTED_CONTRIBUTOR
- MODERATOR
- ADMIN
- SUPER_ADMIN

## Security rules

- never expose password hashes
- ownership checks required
- sensitive changes require audit records
