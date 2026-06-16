# E-Bike Land - eBike Repair Marketplace

A professional Hebrew RTL mobile app connecting eBike owners with certified repair technicians.

## Features

### Customer Features
- **Authentication**: Email/password sign-up and login with Better Auth
- **Home Screen**: Interactive map showing nearby available technicians
- **Repair Request**: 4-step guided process to report issues (photo, description, bike type, price estimate)
- **Technician Selection**: Filter and sort technicians by distance, rating, or price
- **Real-Time Tracking**: Live map tracking of technician arrival with ETA
- **Job Completion**: Rate and review technicians after service
- **Order History**: View past, active, and cancelled orders
- **Profile Management**: Edit profile, manage addresses, and settings

### Technician Features
- **Separate Authentication**: Dedicated technician sign-up with admin approval required
- **Dashboard**: Availability toggle, stats (jobs, earnings, rating), location tracking
- **Incoming Requests**: Real-time job notifications with accept/decline
- **Active Job Management**: Status updates, navigation, customer communication
- **Job Completion**: Final pricing, parts tracking, payment collection
- **Jobs List**: View active and completed jobs
- **Earnings**: Balance tracking, withdrawal, transaction history
- **Profile**: Service details, bio, verification status

### Authentication System
- **Customer Access**: Open registration - anyone can sign up as a customer
- **Technician Access**: Restricted registration - technicians must:
  1. Register through dedicated technician sign-up
  2. Wait for admin approval (isApproved flag)
  3. Access restricted to approved technicians only
- **Role-based Routing**: Automatic redirection based on user role and approval status

## Tech Stack

### Frontend
- **Framework**: Expo SDK 53 + React Native 0.76.7
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: Zustand (persisted with AsyncStorage)
- **Server State**: React Query (@tanstack/react-query)
- **Maps**: react-native-maps
- **Animations**: react-native-reanimated
- **Icons**: lucide-react-native

### Backend
- **Framework**: Bun + Hono
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Better Auth (@better-auth/expo)
- **Deployment**: Auto-deployed on Vibecode Cloud

## Database Schema

The app uses PostgreSQL with the following main tables:

- **User**: Stores user accounts with role (customer/technician) and approval status
  - `role`: "customer" (default) or "technician"
  - `isApproved`: true for customers, false for pending technician approval
- **Session**: Better Auth session management
- **Account**: Better Auth account credentials
- **Verification**: Email verification tokens

## User Roles

1. **Customer** (default)
   - Open registration
   - Auto-approved (`isApproved = true`)
   - Access to customer features immediately

2. **Technician** (restricted)
   - Register via `/technician-sign-up`
   - Pending approval (`isApproved = false`)
   - Admin must approve before access granted
   - Access to technician dashboard when approved

## Project Structure

```
src/
├── app/
│   ├── _layout.tsx           # Root layout with providers
│   ├── index.tsx             # Sign-in screen (entry point)
│   ├── (customer)/           # Customer routes
│   │   ├── (tabs)/
│   │   │   ├── index.tsx     # Home with map
│   │   │   ├── orders.tsx    # Order history
│   │   │   └── profile.tsx   # Customer profile
│   ├── (technician)/         # Technician routes
│   │   ├── (tabs)/
│   │   │   ├── index.tsx     # Dashboard
│   │   │   ├── jobs.tsx      # Jobs list
│   │   │   ├── earnings.tsx  # Earnings
│   │   │   └── profile.tsx   # Technician profile
│   │   └── active-job.tsx    # Active job management
│   ├── repair-request.tsx    # 4-step repair request
│   ├── technician-select.tsx # Technician selection
│   ├── job-tracking.tsx      # Real-time tracking
│   ├── job-complete.tsx      # Rating & completion
│   └── technician-profile.tsx# Technician details modal
├── components/               # Reusable UI components
└── lib/
    ├── cn.ts                 # className utility
    ├── types.ts              # TypeScript types
    ├── mock-data.ts          # Mock data for demo
    ├── store.ts              # Zustand stores
    ├── supabase.ts           # Supabase client
    ├── database.types.ts     # Database TypeScript types
    ├── hooks/
    │   └── useSupabase.ts    # Data hooks for Supabase
    └── i18n/
        └── index.ts          # Hebrew/English translations
```

## Design System

### Colors
- Primary: Blue (#3B82F6) to Purple (#8B5CF6) gradient
- Success: Green (#10B981)
- Error: Red (#EF4444)
- Warning: Yellow (#F59E0B)

### Typography
- System fonts (SF Pro on iOS, Roboto on Android)
- RTL support enabled by default

### Spacing
- Consistent 4px grid: 4, 8, 12, 16, 24, 32px

### Border Radius
- Buttons: 8px
- Cards: 12-16px
- Modals: 24px

## Key Screens

1. **Sign In**: Google/Apple authentication (customer default, technician option)
2. **Customer Home**: Map with technician markers and repair request FAB
3. **Repair Request**: Photo upload, description, bike type, category, price estimate
4. **Technician Selection**: Filter/sort available technicians
5. **Job Tracking**: Real-time map with technician location
6. **Job Completion**: Rating stars and category feedback
7. **Technician Dashboard**: Availability, stats, incoming requests
8. **Active Job**: Status updates and customer communication

## Running the App

The app runs automatically on port 8081 via Vibecode. No manual setup required.

## Notes

- RTL is enforced for Hebrew language support
- Mock data available for demo (before Supabase setup)
- Location permissions required for map features
- Real-time updates for job status and technician location
