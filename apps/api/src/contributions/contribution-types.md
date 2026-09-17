# Contribution Domain

## Types

CREATE_PLACE
EDIT_PLACE
ADD_PHOTO
CHANGE_LOCATION
CHANGE_OPENING_HOURS
CHANGE_PRICE
REPORT_CLOSED
REPORT_INCORRECT

## Core fields

- id
- userId
- placeId optional
- type
- payload
- status
- reviewerId
- reviewedAt
- createdAt

The payload stores proposed changes. Approved changes are applied through domain services only.
