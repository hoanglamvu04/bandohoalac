# Moderation Workflow

## Purpose

Review community contributions before updating official place data.

## States

- DRAFT
- SUBMITTED
- PENDING
- NEEDS_CHANGES
- APPROVED
- REJECTED

## Approval flow

Contribution submitted

-> Moderator review

-> APPROVED:
- update place
- create revision
- create audit record
- trigger points event

-> REJECTED:
- preserve contribution history
- record reason

## Moderator actions

- approve
- reject
- request changes
- inspect revision diff

No destructive updates are allowed.
