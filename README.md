# Nail Booking

A Next.js app for booking nail appointments with an admin panel for managing availability and cancellations.

## Features

- Customer booking page with calendar and time slots
- Booking form for name, nail type, and phone number
- Admin panel to open/close days for booking
- Admin can cancel booked appointments
- MongoDB-backed API routes

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file and update values:

```bash
cp .env.example .env.local
```

Set:

- `MONGODB_URI` — your MongoDB connection string
- `ADMIN_PASSWORD` — password used on the admin page

3. Start MongoDB locally or use MongoDB Atlas.

4. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for booking and [http://localhost:3000/admin](http://localhost:3000/admin) for admin.

## API

- `GET /api/availability?date=YYYY-MM-DD` — available slots for a day
- `PUT /api/availability` — admin: set day active/inactive
- `GET /api/appointments?date=YYYY-MM-DD&status=booked` — list appointments
- `POST /api/appointments` — create a booking
- `PATCH /api/appointments/[id]` — admin: cancel a booking

Admin routes require the `x-admin-password` header.

## Tech stack

- Next.js 15 (App Router)
- Tailwind CSS 4
- MongoDB + Mongoose
- TypeScript
