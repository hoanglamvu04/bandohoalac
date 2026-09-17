# Auth Module Boundary

Future NestJS module:

```
auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   ├── access-token.strategy.ts
│   └── refresh-token.strategy.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── permission.guard.ts
└── dto/
```

Responsibilities:

- login
- register
- refresh session
- logout
- OAuth integration points
- authentication guards

Non responsibilities:

- place authorization rules
- moderation workflow
- business scoring

Those belong to their own domain modules.
