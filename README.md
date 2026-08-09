# Nail Booking

Next.js app for nail appointment booking with phone/password auth, profiles, notifications, and an admin panel.

## Features

- Login required (phone + password); shared admin role
- Booking flow: service → date → time → confirm
- Profile with editable name/phone, attendance history, monthly chart
- In-app notifications + optional browser Web Push
- Admin: day/slot availability, approve/cancel, attendance, service catalog (name, price, duration)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env and set values:

```bash
cp .env.example .env.local
```

Required:

- `MONGODB_URI` — MongoDB connection (or `USE_MOCK_DATA=true`)
- `JWT_SECRET` — session signing secret (16+ chars)
- `ADMIN_PHONE` + `ADMIN_PASSWORD` — seeded admin account on first connect

Optional Web Push:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Generate with: `npx web-push generate-vapid-keys`

3. Run:

```bash
npm run dev
```

- [http://localhost:3000](http://localhost:3000) — booking (after login)
- [http://localhost:3000/admin](http://localhost:3000/admin) — admin (admin role)
- [http://localhost:3000/profile](http://localhost:3000/profile) — profile

## Tech stack

- Next.js 15 (App Router)
- Tailwind CSS 4
- MongoDB + Mongoose
- jose (JWT cookies), bcryptjs, web-push
- TypeScript
