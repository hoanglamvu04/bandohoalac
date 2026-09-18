# Hola Maps API Modules

Runtime module boundaries:

- auth
- users
- places
- categories
- contributions
- moderation
- points
- media

Rules:

- Controllers expose HTTP only.
- Services contain business logic.
- Database access stays in repositories.
- Domain workflows must preserve audit history.
