# Contribution Workflow

## Principle

Users never directly overwrite trusted place data. Changes enter a contribution pipeline.

## Contribution Types

- CREATE_PLACE
- EDIT_PLACE
- ADD_PHOTO
- CHANGE_LOCATION
- CHANGE_OPENING_HOURS
- CHANGE_PRICE
- REPORT_CLOSED
- REPORT_INCORRECT

## Lifecycle

DRAFT -> SUBMITTED -> PENDING -> APPROVED / REJECTED / NEEDS_CHANGES

## Approval Flow

1. Contributor submits change
2. Moderator reviews payload
3. Approved contribution updates place
4. Place revision is created
5. Audit record is stored
6. Points event is emitted

## Revision Safety

Original data is never destroyed. Every approved change has a revision snapshot.
