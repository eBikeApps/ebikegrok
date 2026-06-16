# eBike App - Dual-Role Authentication System

## Overview

This app uses **Better Auth** for authentication with **Email + Password** flow, supporting two user roles: **Customers** and **Technicians**. The backend is powered by **Hono**, **Prisma ORM**, and **PostgreSQL**. The mobile frontend is built with **Expo** and **React Native**.

## Features

- Dual-role authentication (Customer & Technician)
- Email + Password authentication
- Technician approval system
- Role-based navigation
- Hebrew RTL support
- Green theme design
- Animated eBike logo with spinning wheel overlays on sign-in screen
- Real-time technician selection with database integration
- Distance-based technician filtering
- Technician profile management
- **4-step repair request flow:**
  1. Photo upload (required)
  2. **Customer details collection (name, phone, email)**
  3. Bike type & repair category selection
  4. Price estimate display
- Email notifications to representatives via Resend API when no technicians are available

## Backend Setup

### Files Created/Modified:

1. **`backend/src/prisma.ts`** - Prisma client with SQLite optimizations
2. **`backend/src/auth.ts`** - Better Auth configuration with Email OTP plugin
3. **`backend/src/index.ts`** - Updated with auth middleware and auth handler route
4. **`backend/src/env.ts`** - Added DATABASE_URL and BETTER_AUTH_SECRET to environment schema
5. **`backend/prisma/schema.prisma`** - User, Session, Account, and Verification models

### Environment Variables:

- `DATABASE_URL` - PostgreSQL database connection string
- `BETTER_AUTH_SECRET` - Secret key for auth (generated with `openssl rand -base64 32`)
- `RESEND_API_KEY` - Resend API key for email delivery (get from https://resend.com)
- `FROM_EMAIL` - Sender email address for notifications (default: onboarding@resend.dev)

### Auth Endpoints:

- `POST /api/auth/sign-up/email` - Register with email and password
- `POST /api/auth/sign-in/email` - Sign in with email and password
- `POST /api/auth/sign-out` - Logout
- `GET /api/auth/session` - Get current session
- `GET /api/me` - Protected route example (requires auth)

## Mobile Setup

### Files Created:

1. **`mobile/src/lib/auth/auth-client.ts`** - Better Auth client setup with Expo
2. **`mobile/src/lib/auth/use-session.ts`** - Session hook using React Query with async invalidation
3. **`mobile/src/lib/api/api.ts`** - Authenticated API client
4. **`mobile/src/app/sign-in.tsx`** - Customer sign-in screen
5. **`mobile/src/app/sign-up.tsx`** - Customer registration screen
6. **`mobile/src/app/technician-sign-in.tsx`** - Technician sign-in with role verification
7. **`mobile/src/app/technician-sign-up.tsx`** - Technician registration (requires approval)
8. **`mobile/src/app/role-select.tsx`** - Initial role selection screen

### Files Modified:

1. **`mobile/src/app/_layout.tsx`** - Added Stack.Protected guards for auth-protected routes

## Authentication Flow

### Customer Sign Up:

1. User selects "Customer" on role-select screen
2. User enters name, email, and password on `sign-up.tsx`
3. Backend creates new user with `role: "customer"` and `isApproved: true`
4. User is automatically signed in
5. Navigates to customer tabs: `/(customer)/(tabs)`

### Customer Sign In:

1. User enters email and password on `sign-in.tsx`
2. Backend verifies credentials
3. Session created on success
4. Navigates to customer tabs: `/(customer)/(tabs)`

### Technician Sign Up:

1. User selects "Technician" on role-select screen
2. User enters name, email, password, and additional details on `technician-sign-up.tsx`
3. Backend creates new user with `role: "technician"` and `isApproved: false`
4. Alert shown: "Account pending approval"
5. User cannot sign in until admin approves

### Technician Sign In:

1. User enters email and password on `technician-sign-in.tsx`
2. Backend verifies credentials
3. **Role verification**: Checks if `user.role === "technician"`
4. **Approval check**: Checks if `user.isApproved === true`
5. If approved: Navigates to technician tabs: `/(technician)/(tabs)`
6. If not approved: Shows alert and signs out

### Sign Out:

```typescript
import { authClient } from "@/lib/auth/auth-client";
import { useInvalidateSession } from "@/lib/auth/use-session";

const invalidateSession = useInvalidateSession();

await authClient.signOut();
await invalidateSession();
// Stack.Protected automatically navigates to sign-in
```

## API Usage

### Making Authenticated Requests:

```typescript
import { api } from "@/lib/api/api";

// GET
const data = await api.get<{ user: User }>("/api/me");

// POST
const result = await api.post<{ success: boolean }>("/api/users", { name: "John" });

// DELETE
await api.delete("/api/users/123");
```

## Database

SQLite database is automatically synced with Prisma schema. To make changes:

1. Update `backend/prisma/schema.prisma`
2. Run `bunx prisma db push` to sync changes

## Important Notes

- **Better Auth Custom Fields**: The `role` and `isApproved` fields are configured in `backend/src/auth.ts` using `user.additionalFields`. This is REQUIRED for Better Auth to return these fields in the session.
- **Session invalidation**: `useInvalidateSession()` returns an async function that must be awaited to ensure React Query refetches the session before navigation
- **Role-based routing**: The `index.tsx` file checks user role and approval status to redirect to the correct tab group
- **Technician approval**: New technicians have `isApproved: false` by default and cannot sign in until an admin updates this field in the database
- **Session caching** is set to 5 minutes to reduce backend hits
- **TypeScript** is strictly enforced - all types are auto-generated from Prisma schema

## Technician System

### Database Schema
The User model includes technician-specific fields:
- `phone` - Contact phone number
- `bio` - Professional description
- `rating` - Average rating (0-5)
- `totalReviews` - Number of reviews received
- `vehicleType` - Type of vehicle (e.g., "אופנוע + ציוד נייד")
- `serviceRadius` - Service area in kilometers
- `isAvailable` - Current availability status
- `currentLocationLat/Lng` - Current GPS coordinates
- `basePrice` - Base service price in NIS
- `totalEarnings` - Total earnings to date

### Technician API Endpoints

#### Get Available Technicians
```
GET /api/technicians/available?lat=32.0853&lng=34.7818
```
Returns list of available technicians filtered by location and service radius, with calculated distance and ETA.

#### Get Technician Profile
```
GET /api/technicians/:id
```
Returns detailed technician profile by ID.

#### Update Technician Profile (Auth Required)
```
PATCH /api/technicians/profile
Body: { phone, bio, vehicleType, serviceRadius, isAvailable, currentLocationLat, currentLocationLng, basePrice }
```

#### Update Availability (Auth Required)
```
PATCH /api/technicians/availability
Body: { isAvailable: boolean }
```

#### Update Location (Auth Required)
```
PATCH /api/technicians/location
Body: { lat: number, lng: number }
```

### Frontend Integration
- **`mobile/src/app/(customer)/(tabs)/index.tsx`** - Customer home screen with real-time technician map (loads real data from database)
- **`mobile/src/app/technician-profile.tsx`** - Technician profile view (loads real data from database)
- **Mock data removed** - All screens now fetch real technician data from the backend
- **`mobile/src/app/(technician)/(tabs)/index.tsx`** - Technician dashboard (mock incoming requests removed, ready for real job notifications)

### Important Changes (Feb 16, 2026)
- **Removed mock/fake customer requests** - Technicians will no longer see fake incoming job requests
- When a technician is available, they will only receive real job requests from actual customers
- Customers searching for technicians will only see technicians who are:
  - Actually available (`isAvailable: true`)
  - Within service radius
  - Have location enabled

### Seeding Sample Technicians
**Note:** Seed technicians have been removed. Only real technicians in the database will appear.

## Contact System

### Send Details to Representative
When no technicians are available in the area, customers can send their repair request details directly to a representative via email using Resend.

#### Backend API
```
POST /api/contact/send-details
Body: {
  photo_uri: string,
  description: string,
  bike_type: 'regular' | 'electric',
  category: RepairCategory,
  location?: { latitude: number, longitude: number, address?: string },
  customer_name?: string,
  customer_phone?: string,
  customer_email?: string
}
```

#### Email Service Configuration (Resend)
The backend uses **Resend** for email delivery. Configure the following environment variables in `backend/.env`:
- `RESEND_API_KEY` - Your Resend API key (get from https://resend.com)
- `FROM_EMAIL` - Sender email address (default: onboarding@resend.dev)

Emails are sent to: `ebikelandapp@gmail.com`

#### Frontend Integration
- **`mobile/src/app/technician-select.tsx`** - Shows "שלח את הפרטים לנציג" button when no technicians are available
- **`mobile/src/lib/api/contact.ts`** - API client for sending contact details
- Button appears with gradient styling and loading state
- Success confirmation dialog with auto-navigation back

## System Sounds (Updated April 2026)

Pleasant, catchy UX sound effects integrated into key user actions, paired with matching haptics.

### Files
- **`mobile/src/lib/system-sounds.ts`** — sound system module (uses `expo-audio` + `expo-haptics`)
- **`mobile/src/assets/sounds/*.mp3`** — bundled sound files (Mixkit free SFX)

### Sound types
| Key | When it plays |
|---|---|
| `tap` | Subtle tab/minor button (selection haptic) |
| `click` | Button press, technician select |
| `success` | Sign-in / sign-up success, booking confirmed |
| `notification` | Incoming push notification received |
| `error` | Validation failure, server error |
| `swoosh` | Page transition (e.g. submit repair request) |
| `complete` | Job completed, technician accepts job |
| `new_job` | New incoming job for technician (with warning haptic) |

### Usage
```typescript
import { playSystemSound } from '@/lib/system-sounds';

playSystemSound('success');  // plays sound + haptic
```

The system pre-warms players at app startup (`preloadSystemSounds()` in `_layout.tsx`) so the first play has zero latency. Call `setSystemSoundsEnabled(false)` to mute all sounds (haptics still fire).

To customize sounds: replace files in `mobile/src/assets/sounds/` (or upload via the Vibecode SOUNDS tab).

## Admin Panel (Updated March 2026)

### Access Control
The admin panel is accessible to specific email accounts in the technician tabs:
- Admin emails: `all4carsonline@gmail.com`, `maortest@ebikeland.com`, `ebikelandapp@gmail.com`
- These accounts bypass the approval requirement and can sign in directly
- The admin tab (`ניהול`) appears only for these emails
- Backend admin API routes are protected by email-based auth (same list)

### Admin Capabilities
- View all technicians (pending, active, inactive)
- Approve new technicians
- Revoke technician approval
- Remove technicians from the system

