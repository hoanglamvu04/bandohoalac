# HOLA Embed Platform V1 — approval-based iframe access

## Security model

An iframe URL key is visible to every visitor. It is a **public, revocable
embed identifier**, not a secret and not an API credential. The browser
enforces a dynamic CSP frame-ancestors allowlist based on each APPROVED
application. Never place private Developer API keys, JWTs or secret tokens
in the iframe URL.

## Partner workflow

1. The partner signs into HOLA Maps and opens /developers/embed.
2. They submit their app name, email and 1–10 exact HTTPS origins.
3. Admin verifies ownership/authorization of the requested origins, then
   visits /admin/developer-api → Nhúng bản đồ to approve. A privileged
   Admin session with verified two-factor authentication is required.
4. The application receives a public key starting with he_, valid for 365
   days by default. The applicant can retrieve it on their account page.
5. The partner copies the iframe code for their approved domain.
6. Each iframe document load triggers Nginx auth_request. The backend
   checks the public key, app status and expiry, then returns approved
   origins only. Nginx emits an enforced frame-ancestors directive.
7. Admin may rotate, extend or revoke any application independently.

Example HTML (dummy key, not a working credential):

    <iframe title="HOLA Maps"
      src="https://maps.dothihoalac.vn/embed?key=he_EXAMPLE_PUBLIC_KEY"
      loading="lazy" referrerpolicy="no-referrer"
      style="width:100%;height:620px;border:0;border-radius:12px"
      allow="geolocation"></iframe>

For HALO HOLA story layer use /embed/halo?key=... .
Location picker uses /embed/picker?key=... .
Separate applications get separate keys. HALO HOLA can request two origins:
https://halohola.vn and https://www.halohola.vn.

## APIs

Admin (authenticated, ADMIN role, two-factor verified):
- GET /api/admin/embed-applications
- POST /api/admin/embed-applications/direct
- POST /api/admin/embed-applications/:id/approve
- POST /api/admin/embed-applications/:id/reject
- POST /api/admin/embed-applications/:id/rotate
- POST /api/admin/embed-applications/:id/revoke

Authenticated applicant:
- POST /api/embed/requests
- GET /api/embed/requests/mine

Internal iframe-gateway policy:
- GET /api/embed/authorize with Nginx X-Original-URI header
- Valid active public key returns HTTP 204 and approved HTTPS origins.
- Missing/revoked/expired keys return HTTP 403.
- The header only contains origin values validated by the server.
- The backend port must not be exposed externally on the VPS firewall.

## Deployment

1. Apply migration 20261102_190_embed_platform_v1.sql.
2. Build frontend/dist.
3. Restart the backend on 127.0.0.1:5003.
4. Run scripts/install-embed-gateway.sh (integrated into deploy-vps.yml).
   The script inserts an idempotent Nginx include, checks nginx -t and
   reloads. On invalid Nginx config it restores the previous vhost.
5. Approve HALO HOLA in the Admin console, copy the issued iframe URL.
6. Change the iframe on halohola.vn/hola-map from the old URL without
   a key to the approved URL. Without a key it intentionally returns 403.
7. Verify response headers on the embed HTML document:
   enforced CSP must include the exact approved origins, with no
   X-Frame-Options on /embed or /embed/*. Other routes keep DENY.
8. Test embedding from the approved origin, from an unapproved origin,
   after revocation and after expiry. Verify internal /embed/halo links.

## Limitations and next phases

- Manual approval is required. DNS TXT domain ownership proof can become
  a self-service automated step in V2.
- Public keys are not secrets. CSP restricts parent origins, not access
  to data already published by the public map API.
- Revocation blocks new frame document loads; it cannot close an
  already-loaded iframe without reload.
- In-app authentication inside third-party iframes may be affected by
  blocked third-party cookies; public discovery does not need them.
- The gateway requires Nginx with its standard auth_request module.
  CI exercises backend policy and shell guards; a staging browser
  must additionally inspect actual CSP response headers.
- This implementation supersedes draft PR #58, which used hard-coded
  HALO HOLA origins. Do not merge both approaches.
