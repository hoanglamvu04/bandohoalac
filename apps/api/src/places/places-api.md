# Places API Foundation

## Public endpoints

GET /places

Query:
- category
- search
- page
- limit

GET /places/:slug

GET /places/nearby

Query:
- lat
- lng
- radius

GET /places/bounds

Query:
- north
- south
- east
- west

## Future protected endpoints

POST /places

Should normally create a contribution rather than direct mutation.

PATCH /places/:id

Should create revision/contribution flow.

## Response design

Never expose raw GIS provider data.

Return Hola Maps owned place representation.
