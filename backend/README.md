# WhereAbout Backend

Node.js REST API + Socket.IO service for the WhereAbout mobile app.

## Stack

- **Express 5** — REST API
- **Socket.IO** — realtime auth/profile events
- **MongoDB + Mongoose** — persistence
- **JWT** — access, refresh, pending-session, and password-reset tokens
- **Zod** — request validation
- **Multer** — profile photo & post image uploads
- **Nodemailer** — verification emails (console fallback in development)
- **expo-server-sdk** — Expo push notifications for likes & comments

## Quick start

```bash
# 1. Start MongoDB + Mailpit
cd backend
docker compose up -d

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.development.example .env.development

# 4. Run API + Socket.IO
npm run dev
```

## Environment configuration (local vs production)

Config is segregated per environment and loaded automatically based on `NODE_ENV`:

| NODE_ENV | File loaded | Template |
|----------|-------------|----------|
| `development` (default) | `.env.development` | `.env.development.example` |
| `production` | `.env.production` | `.env.production.example` |

Loading order (first match wins, real process env is never overwritten):
`.env.<NODE_ENV>` → `.env.local` → `.env` (shared fallback). Only the
`*.example` files are committed; the real `.env.*` files are gitignored.

### Run in production

```bash
cp .env.production.example .env.production   # then fill in real secrets
# set APP_URL to your server, e.g. https://mobilevps.tech
npm install
npm run build
npm run start:prod
```

API: `http://localhost:4000`  
Health: `GET /health`  
Socket.IO: `http://localhost:4000/socket.io`  
Mailpit inbox: `http://localhost:8025`

## Auth & registration flow

| Step | Method | Endpoint |
|------|--------|----------|
| Sign up | POST | `/api/v1/auth/register` |
| Verify email (API) | POST | `/api/v1/auth/verify-email` |
| Verify email (browser) | GET | `/api/v1/auth/verify-email/:token/confirm` |
| Resume session after verify | POST | `/api/v1/auth/resume-verified-session` |
| Verification status | GET | `/api/v1/auth/verification-status?email=` |
| Resend verification | POST | `/api/v1/auth/resend-verification` |
| Login | POST | `/api/v1/auth/login` |
| Refresh token | POST | `/api/v1/auth/refresh` |
| Logout | POST | `/api/v1/auth/logout` |
| Forgot password | POST | `/api/v1/auth/forgot-password` |
| Verify reset code | POST | `/api/v1/auth/verify-reset-code` |
| Reset password | POST | `/api/v1/auth/reset-password` |
| Resend reset code | POST | `/api/v1/auth/resend-reset-code` |
| Current user | GET | `/api/v1/auth/me` |
| Save names | PATCH | `/api/v1/auth/profile/names` |
| Upload profile photo | POST | `/api/v1/auth/profile/photo` |
| Parental consent | POST | `/api/v1/auth/profile/parental-consent` |
| Complete registration | POST | `/api/v1/auth/profile/complete-registration` |

## Feed, posts & interactions

All endpoints require a verified-email access token (`Authorization: Bearer <token>`).

| Action | Method | Endpoint |
|--------|--------|----------|
| Feed (paginated, `?limit=&before=`) | GET | `/api/v1/posts` |
| Create post (multipart: `image`, `text`, `placeName`) | POST | `/api/v1/posts` |
| Get single post | GET | `/api/v1/posts/:id` |
| Delete own post | DELETE | `/api/v1/posts/:id` |
| Toggle like | POST | `/api/v1/posts/:id/like` |
| List comments | GET | `/api/v1/posts/:id/comments` |
| Add comment | POST | `/api/v1/posts/:id/comments` |

## Notifications & push

| Action | Method | Endpoint |
|--------|--------|----------|
| List notifications | GET | `/api/v1/notifications` |
| Unread count | GET | `/api/v1/notifications/unread-count` |
| Mark read (`{ ids? }`) | POST | `/api/v1/notifications/read` |
| Register Expo push token | POST | `/api/v1/notifications/push-token` |
| Remove Expo push token | DELETE | `/api/v1/notifications/push-token` |

Liking or commenting on a post creates a notification for the post author (never for
self-actions), emits a realtime `notification:new` event, and sends an Expo push
notification to all of the author's registered devices.

## Socket.IO

Connect with auth token:

```ts
io('http://localhost:4000', {
  auth: { token: pendingSessionTokenOrAccessToken },
});
```

Events emitted by server:

- `connection:ready`
- `auth:email-verified`
- `auth:password-reset-code-sent`
- `auth:password-reset-completed`
- `user:profile-updated`
- `user:parental-consent-recorded`
- `user:registration-completed`
- `post:created` — new post added to the feed (broadcast)
- `post:updated` — like count / post changed (to author)
- `comment:created` — new comment (to author + viewers of the post)
- `notification:new` — a new like/comment notification (to recipient)
- `notification:read` — unread count changed (to recipient)

## Development emails

Local testing uses **Mailpit** (included in Docker Compose). It catches all outgoing emails so you can preview the branded templates in a web inbox.

```bash
cd backend
docker compose up -d          # starts MongoDB + Mailpit
npm run dev
```

1. Sign up in the app (or `POST /api/v1/auth/register`)
2. Open **http://localhost:8025** to view the verification email
3. Click **Verify email address** in the email, or copy the link from the backend console

Verification links are also logged to the backend terminal in development.

To disable real SMTP and log emails to the console only, clear `SMTP_HOST` in `.env`.

### Email templates

Branded HTML templates live in `backend/templates/emails/`:

- `verification-email.html` — sign-up verification email
- `verification-success.html` — browser success page after clicking the link
- `verification-error.html` — expired or already-used link page

Templates are rendered by `src/templates/emailTemplates.ts` with placeholders like `{{userEmail}}`, `{{verifyUrl}}`, and `{{deepLinkUrl}}`.

## Physical device testing

Replace `localhost` with your computer's LAN IP in the mobile app `EXPO_PUBLIC_API_URL`.

Example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.6:4000
```
