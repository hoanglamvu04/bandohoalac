# Add Place Workflow

## Purpose

Allow contributors to submit new places through a controlled contribution flow.

## Flow

1. User opens /contribute/new
2. Request browser geolocation permission
3. Capture:
   - latitude
   - longitude
   - accuracy meters
   - timestamp
4. Display location on MapLibre map
5. User adjusts draggable pin if needed
6. Submit place information
7. Create CREATE_PLACE contribution
8. Send to moderation queue

## Location separation

Device location is evidence metadata only.

Official place location is stored only after moderation approval.

## Submission payload

- name
- category
- description
- coordinates
- accuracy
- photos
- contributor metadata
