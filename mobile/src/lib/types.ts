// User types
export type UserRole = 'customer' | 'technician';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  avatar_url?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface CustomerProfile extends User {
  role: 'customer';
  default_address?: string;
  default_location?: Location;
  saved_addresses: SavedAddress[];
}

export interface TechnicianProfile extends User {
  role: 'technician';
  bio?: string;
  rating: number;
  total_reviews: number;
  verification_status: 'pending' | 'verified' | 'rejected';
  vehicle_type?: string;
  service_radius: number; // in km
  is_available: boolean;
  current_location?: Location;
  base_price: number;
  call_out_fee?: number;
  bank_details?: BankDetails;
  total_earnings: number;
}

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  location: Location;
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface BankDetails {
  bank_name: string;
  branch_number: string;
  account_number: string;
  account_holder: string;
}

// Bike types
export type BikeType = 'regular' | 'electric';

export type RepairCategory =
  | 'front_tire_puncture'
  | 'rear_tire_puncture'
  | 'tire_tube_replacement'
  | 'brake_issue'
  | 'starts_no_drive'
  | 'general_electrical'
  | 'general_service';

export const REPAIR_CATEGORIES: { key: RepairCategory; labelKey: string }[] = [
  { key: 'front_tire_puncture', labelKey: 'frontTirePuncture' },
  { key: 'rear_tire_puncture', labelKey: 'rearTirePuncture' },
  { key: 'tire_tube_replacement', labelKey: 'tireTubeReplacement' },
  { key: 'brake_issue', labelKey: 'brakeIssue' },
  { key: 'starts_no_drive', labelKey: 'startsNoDrive' },
  { key: 'general_electrical', labelKey: 'generalElectrical' },
  { key: 'general_service', labelKey: 'generalService' },
];

// Fixed prices based on category and bike type
export const PRICE_RANGES: Record<RepairCategory, { regular: [number, number]; electric: [number, number] }> = {
  front_tire_puncture: { regular: [200, 200], electric: [200, 200] },
  rear_tire_puncture: { regular: [200, 200], electric: [200, 200] },
  tire_tube_replacement: { regular: [350, 350], electric: [350, 350] },
  brake_issue: { regular: [200, 200], electric: [200, 200] },
  starts_no_drive: { regular: [250, 250], electric: [250, 250] },
  general_electrical: { regular: [250, 250], electric: [250, 250] },
  general_service: { regular: [300, 300], electric: [300, 300] },
};

// Job types
export type JobStatus =
  | 'pending'
  | 'accepted'
  | 'on_way'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface RepairRequest {
  photo_uri: string | null;
  description: string;
  bike_type: BikeType;
  categories: RepairCategory[];
  estimated_price_min: number;
  estimated_price_max: number;
}

export interface Job {
  id: string;
  job_number?: number;
  customer_id: string;
  technician_id?: string;
  status: JobStatus;

  // Request details
  photo_url: string;
  description: string;
  bike_type: BikeType;
  categories: RepairCategory[];
  estimated_price_min: number;
  estimated_price_max: number;

  // Location
  customer_location: Location;
  technician_location?: Location;

  // Timing
  created_at: string;
  accepted_at?: string;
  on_way_at?: string;
  arrived_at?: string;
  in_progress_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;

  // Payment
  payment_status?: 'pending' | 'paid' | 'failed';
  payment_url?: string;

  // Completion details
  final_price?: number;
  parts?: JobPart[];
  before_photos?: string[];
  after_photos?: string[];
  technician_notes?: string;

  // Rating
  rating?: number;
  rating_categories?: RatingCategories;
  feedback?: string;

  // Relations (populated)
  customer?: CustomerProfile;
  technician?: TechnicianProfile;
  secondary_technician_id?: string;
  secondary_technician?: TechnicianProfile;
}

export interface JobPart {
  name: string;
  price: number;
}

export interface RatingCategories {
  professionalism: boolean;
  speed: boolean;
  cleanliness: boolean;
  fair_price: boolean;
}

// Review types
export interface Review {
  id: string;
  jobId: string;
  customerId: string;
  technicianId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  customer?: { id: string; name: string; image?: string };
  // legacy fields (kept for compatibility)
  job_id?: string;
  customer_id?: string;
  technician_id?: string;
  feedback?: string;
  created_at?: string;
}

// Earnings types
export interface EarningsStats {
  today: number;
  this_week: number;
  this_month: number;
  total: number;
}

export interface Transaction {
  id: string;
  technician_id: string;
  job_id?: string;
  type: 'earning' | 'withdrawal';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

// Notification types
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// Filter types
export type TechnicianSortOption = 'nearest' | 'highest_rated' | 'lowest_price';
export type OrderFilterOption = 'all' | 'last_week' | 'last_month';
export type OrderTabOption = 'active' | 'history' | 'cancelled';

// Payment types
export interface Payment {
  id: string;
  job_id: string;
  amount: number;
  commission_amount: number;
  net_amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  morning_payment_id?: string;
  payment_url?: string;
  created_at: string;
  paid_at?: string;
}

export interface ExtraRepairRequest {
  id: string;
  job_id: string;
  technician_id: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  payment_url?: string;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  technician_id: string;
  amount: number;
  bank_name: string;
  branch_number: string;
  account_number: string;
  account_holder: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  notes?: string;
  created_at: string;
}
