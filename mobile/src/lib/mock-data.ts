import {
  TechnicianProfile,
  CustomerProfile,
  Job,
  Review,
  Location,
} from './types';

// Mock technicians data
export const mockTechnicians: TechnicianProfile[] = [
  {
    id: 'tech-1',
    name: 'דוד כהן',
    email: 'david@example.com',
    phone: '+972501234567',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    role: 'technician',
    bio: 'טכנאי אופניים מקצועי עם 10 שנות ניסיון. מתמחה באופניים חשמליים ותיקוני חירום.',
    rating: 4.8,
    total_reviews: 127,
    verification_status: 'verified',
    vehicle_type: 'אופנוע + ציוד נייד',
    service_radius: 15,
    is_available: true,
    current_location: {
      latitude: 32.0853,
      longitude: 34.7818,
      address: 'תל אביב',
    },
    base_price: 50,
    total_earnings: 45000,
    created_at: '2023-01-15T10:00:00Z',
    updated_at: '2024-01-20T15:30:00Z',
  },
  {
    id: 'tech-2',
    name: 'משה לוי',
    email: 'moshe@example.com',
    phone: '+972502345678',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
    role: 'technician',
    bio: 'מומחה לתיקוני פנצ\'רים ובלמים. שירות מהיר ואמין.',
    rating: 4.6,
    total_reviews: 89,
    verification_status: 'verified',
    vehicle_type: 'רכב + ציוד מלא',
    service_radius: 20,
    is_available: true,
    current_location: {
      latitude: 32.0789,
      longitude: 34.7723,
      address: 'תל אביב',
    },
    base_price: 45,
    total_earnings: 38000,
    created_at: '2023-03-20T08:00:00Z',
    updated_at: '2024-01-19T12:00:00Z',
  },
  {
    id: 'tech-3',
    name: 'יוסי אברהם',
    email: 'yossi@example.com',
    phone: '+972503456789',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
    role: 'technician',
    bio: 'טכנאי מוסמך לאופניים חשמליים. מתמחה בבעיות סוללה ומנוע.',
    rating: 4.9,
    total_reviews: 156,
    verification_status: 'verified',
    vehicle_type: 'אופנוע',
    service_radius: 12,
    is_available: true,
    current_location: {
      latitude: 32.0921,
      longitude: 34.7896,
      address: 'תל אביב',
    },
    base_price: 60,
    total_earnings: 52000,
    created_at: '2022-11-10T09:00:00Z',
    updated_at: '2024-01-20T18:00:00Z',
  },
  {
    id: 'tech-4',
    name: 'אלי מזרחי',
    email: 'eli@example.com',
    phone: '+972504567890',
    avatar_url: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop',
    role: 'technician',
    bio: 'שירות תיקונים ניידים לכל סוגי האופניים. זמין 7 ימים בשבוע.',
    rating: 4.5,
    total_reviews: 64,
    verification_status: 'verified',
    vehicle_type: 'רכב',
    service_radius: 25,
    is_available: false,
    current_location: {
      latitude: 32.0654,
      longitude: 34.7654,
      address: 'תל אביב',
    },
    base_price: 40,
    total_earnings: 28000,
    created_at: '2023-06-01T11:00:00Z',
    updated_at: '2024-01-18T09:00:00Z',
  },
];

// Mock customer data
export const mockCustomer: CustomerProfile = {
  id: 'cust-1',
  name: 'שרה ישראלי',
  email: 'sarah@example.com',
  phone: '+972505678901',
  avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
  role: 'customer',
  default_address: 'רוטשילד 22, תל אביב',
  default_location: {
    latitude: 32.0636,
    longitude: 34.7708,
    address: 'רוטשילד 22, תל אביב',
  },
  saved_addresses: [
    {
      id: 'addr-1',
      label: 'בית',
      address: 'רוטשילד 22, תל אביב',
      location: { latitude: 32.0636, longitude: 34.7708 },
    },
    {
      id: 'addr-2',
      label: 'עבודה',
      address: 'רחוב הברזל 5, רמת החייל',
      location: { latitude: 32.1127, longitude: 34.8383 },
    },
  ],
  created_at: '2023-08-15T14:00:00Z',
  updated_at: '2024-01-10T10:00:00Z',
};

// Mock jobs data
export const mockJobs: Job[] = [
  {
    id: 'job-1',
    customer_id: 'cust-1',
    technician_id: 'tech-1',
    status: 'completed',
    photo_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    description: 'פנצ\'ר בגלגל האחורי. קרה בזמן רכיבה בפארק הירקון.',
    bike_type: 'electric',
    categories: ['rear_tire_puncture'],
    estimated_price_min: 100,
    estimated_price_max: 150,
    customer_location: {
      latitude: 32.0853,
      longitude: 34.7818,
      address: 'פארק הירקון, תל אביב',
    },
    created_at: '2024-01-15T10:00:00Z',
    accepted_at: '2024-01-15T10:05:00Z',
    arrived_at: '2024-01-15T10:20:00Z',
    started_at: '2024-01-15T10:25:00Z',
    completed_at: '2024-01-15T10:55:00Z',
    final_price: 120,
    parts: [{ name: 'פנימית 26"', price: 30 }],
    payment_status: 'paid' as const,
    rating: 5,
    rating_categories: {
      professionalism: true,
      speed: true,
      cleanliness: true,
      fair_price: true,
    },
    feedback: 'שירות מעולה! הגיע מהר ותיקן ביעילות.',
    customer: mockCustomer,
    technician: mockTechnicians[0],
  },
  {
    id: 'job-2',
    customer_id: 'cust-1',
    technician_id: 'tech-2',
    status: 'completed',
    photo_url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400',
    description: 'הבלמים לא עובדים טוב, יש רעש מוזר.',
    bike_type: 'regular',
    categories: ['brake_issue'],
    estimated_price_min: 120,
    estimated_price_max: 180,
    customer_location: {
      latitude: 32.0636,
      longitude: 34.7708,
      address: 'רוטשילד 22, תל אביב',
    },
    created_at: '2024-01-10T14:00:00Z',
    accepted_at: '2024-01-10T14:03:00Z',
    arrived_at: '2024-01-10T14:25:00Z',
    started_at: '2024-01-10T14:30:00Z',
    completed_at: '2024-01-10T15:00:00Z',
    final_price: 150,
    parts: [{ name: 'רפידות בלם', price: 40 }],
    payment_status: 'paid' as const,
    rating: 4,
    rating_categories: {
      professionalism: true,
      speed: false,
      cleanliness: true,
      fair_price: true,
    },
    customer: mockCustomer,
    technician: mockTechnicians[1],
  },
  {
    id: 'job-3',
    customer_id: 'cust-1',
    status: 'cancelled',
    photo_url: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400',
    description: 'השרשרת קפצה.',
    bike_type: 'regular',
    categories: ['tire_tube_replacement'],
    estimated_price_min: 100,
    estimated_price_max: 150,
    customer_location: {
      latitude: 32.0700,
      longitude: 34.7800,
      address: 'דיזנגוף 100, תל אביב',
    },
    created_at: '2024-01-05T09:00:00Z',
    cancelled_at: '2024-01-05T09:15:00Z',
    customer: mockCustomer,
  },
];

// Mock reviews
export const mockReviews: Review[] = [
  {
    id: 'review-1',
    jobId: 'job-1',
    customerId: 'cust-1',
    technicianId: 'tech-1',
    rating: 5,
    comment: 'שירות מעולה! הגיע מהר ותיקן ביעילות.',
    createdAt: '2024-01-15T11:00:00Z',
    customer: { id: 'cust-1', name: mockCustomer.name, image: mockCustomer.avatar_url },
  },
  {
    id: 'review-2',
    jobId: 'job-prev-1',
    customerId: 'cust-2',
    technicianId: 'tech-1',
    rating: 5,
    comment: 'מקצוען אמיתי, ממליץ בחום!',
    createdAt: '2024-01-10T16:00:00Z',
  },
  {
    id: 'review-3',
    jobId: 'job-prev-2',
    customerId: 'cust-3',
    technicianId: 'tech-1',
    rating: 4,
    comment: 'טוב מאוד, אבל לקח קצת יותר זמן ממה שציפיתי.',
    createdAt: '2024-01-08T12:00:00Z',
  },
];

// Helper function to calculate distance between two locations
export function calculateDistance(loc1: Location, loc2: Location): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.latitude * Math.PI) / 180) *
      Math.cos((loc2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to estimate arrival time based on distance
export function estimateArrivalTime(distanceKm: number): number {
  // Assume average speed of 25 km/h in city
  const baseMinutes = Math.ceil((distanceKm / 25) * 60);
  // Add 5 minutes for preparation
  return baseMinutes + 5;
}
