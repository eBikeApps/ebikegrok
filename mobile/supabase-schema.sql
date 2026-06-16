-- =============================================
-- E-Bike Land Database Schema
-- =============================================
-- העתק את כל הקוד הזה ל-Supabase SQL Editor והרץ אותו
-- לך ל: Supabase Dashboard > SQL Editor > New Query > הדבק והרץ

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('customer', 'technician')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TECHNICIAN PROFILES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS technician_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  bio TEXT,
  rating DECIMAL(2,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  vehicle_type TEXT,
  service_radius INTEGER DEFAULT 10,
  is_available BOOLEAN DEFAULT false,
  current_lat DECIMAL(10, 8),
  current_lng DECIMAL(11, 8),
  base_price INTEGER DEFAULT 50,
  total_earnings INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- JOBS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'on_way', 'arrived', 'in_progress', 'completed', 'cancelled')),
  photo_url TEXT NOT NULL,
  description TEXT NOT NULL,
  bike_type TEXT NOT NULL CHECK (bike_type IN ('regular', 'electric')),
  category TEXT NOT NULL,
  estimated_price_min INTEGER NOT NULL,
  estimated_price_max INTEGER NOT NULL,
  customer_lat DECIMAL(10, 8) NOT NULL,
  customer_lng DECIMAL(11, 8) NOT NULL,
  customer_address TEXT,
  technician_lat DECIMAL(10, 8),
  technician_lng DECIMAL(11, 8),
  final_price INTEGER,
  parts JSONB,
  technician_notes TEXT,
  payment_method TEXT CHECK (payment_method IN ('cash', 'card')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  rating_categories JSONB,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- =============================================
-- REVIEWS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  technician_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  categories JSONB,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_technician_id ON jobs(technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_technician_profiles_available ON technician_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_technician_profiles_location ON technician_profiles(current_lat, current_lng);
CREATE INDEX IF NOT EXISTS idx_reviews_technician_id ON reviews(technician_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to update technician rating when a new review is added
CREATE OR REPLACE FUNCTION update_technician_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE technician_profiles
  SET
    rating = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews
      WHERE technician_id = NEW.technician_id
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM reviews
      WHERE technician_id = NEW.technician_id
    ),
    updated_at = NOW()
  WHERE user_id = NEW.technician_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating rating
DROP TRIGGER IF EXISTS trigger_update_technician_rating ON reviews;
CREATE TRIGGER trigger_update_technician_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_technician_rating();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_technician_profiles_updated_at ON technician_profiles;
CREATE TRIGGER trigger_technician_profiles_updated_at
BEFORE UPDATE ON technician_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Technician profiles policies
CREATE POLICY "Anyone can view available technicians" ON technician_profiles
  FOR SELECT USING (true);

CREATE POLICY "Technicians can update own profile" ON technician_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Technicians can insert own profile" ON technician_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Jobs policies
CREATE POLICY "Customers can view own jobs" ON jobs
  FOR SELECT USING (auth.uid() = customer_id OR auth.uid() = technician_id);

CREATE POLICY "Customers can create jobs" ON jobs
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Job participants can update" ON jobs
  FOR UPDATE USING (auth.uid() = customer_id OR auth.uid() = technician_id);

-- For demo/development: Allow all operations (remove in production!)
CREATE POLICY "Allow all for development" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON technician_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON reviews FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================

-- Insert sample technicians
INSERT INTO users (id, email, name, avatar_url, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'david@example.com', 'דוד כהן', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop', 'technician'),
  ('22222222-2222-2222-2222-222222222222', 'moshe@example.com', 'משה לוי', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop', 'technician'),
  ('33333333-3333-3333-3333-333333333333', 'yossi@example.com', 'יוסי אברהם', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop', 'technician')
ON CONFLICT (id) DO NOTHING;

INSERT INTO technician_profiles (user_id, bio, rating, total_reviews, verification_status, vehicle_type, service_radius, is_available, current_lat, current_lng, base_price) VALUES
  ('11111111-1111-1111-1111-111111111111', 'טכנאי אופניים מקצועי עם 10 שנות ניסיון. מתמחה באופניים חשמליים ותיקוני חירום.', 4.8, 127, 'verified', 'אופנוע + ציוד נייד', 15, true, 32.0853, 34.7818, 50),
  ('22222222-2222-2222-2222-222222222222', 'מומחה לתיקוני פנצ''רים ובלמים. שירות מהיר ואמין.', 4.6, 89, 'verified', 'רכב + ציוד מלא', 20, true, 32.0789, 34.7723, 45),
  ('33333333-3333-3333-3333-333333333333', 'טכנאי מוסמך לאופניים חשמליים. מתמחה בבעיות סוללה ומנוע.', 4.9, 156, 'verified', 'אופנוע', 12, true, 32.0921, 34.7896, 60)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- =============================================

-- Enable realtime for jobs table (for live tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE technician_profiles;
