export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          phone: string | null
          name: string
          avatar_url: string | null
          role: 'customer' | 'technician'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          phone?: string | null
          name: string
          avatar_url?: string | null
          role: 'customer' | 'technician'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          phone?: string | null
          name?: string
          avatar_url?: string | null
          role?: 'customer' | 'technician'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      technician_profiles: {
        Row: {
          id: string
          user_id: string
          bio: string | null
          rating: number
          total_reviews: number
          verification_status: 'pending' | 'verified' | 'rejected'
          vehicle_type: string | null
          service_radius: number
          is_available: boolean
          current_lat: number | null
          current_lng: number | null
          base_price: number
          total_earnings: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bio?: string | null
          rating?: number
          total_reviews?: number
          verification_status?: 'pending' | 'verified' | 'rejected'
          vehicle_type?: string | null
          service_radius?: number
          is_available?: boolean
          current_lat?: number | null
          current_lng?: number | null
          base_price?: number
          total_earnings?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bio?: string | null
          rating?: number
          total_reviews?: number
          verification_status?: 'pending' | 'verified' | 'rejected'
          vehicle_type?: string | null
          service_radius?: number
          is_available?: boolean
          current_lat?: number | null
          current_lng?: number | null
          base_price?: number
          total_earnings?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'technician_profiles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      jobs: {
        Row: {
          id: string
          customer_id: string
          technician_id: string | null
          status: 'pending' | 'accepted' | 'on_way' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'
          photo_url: string
          description: string
          bike_type: 'regular' | 'electric'
          category: string
          estimated_price_min: number
          estimated_price_max: number
          customer_lat: number
          customer_lng: number
          customer_address: string | null
          technician_lat: number | null
          technician_lng: number | null
          final_price: number | null
          parts: Json | null
          technician_notes: string | null
          payment_method: 'cash' | 'card' | null
          rating: number | null
          rating_categories: Json | null
          feedback: string | null
          created_at: string
          accepted_at: string | null
          arrived_at: string | null
          started_at: string | null
          completed_at: string | null
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          technician_id?: string | null
          status?: 'pending' | 'accepted' | 'on_way' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'
          photo_url: string
          description: string
          bike_type: 'regular' | 'electric'
          category: string
          estimated_price_min: number
          estimated_price_max: number
          customer_lat: number
          customer_lng: number
          customer_address?: string | null
          technician_lat?: number | null
          technician_lng?: number | null
          final_price?: number | null
          parts?: Json | null
          technician_notes?: string | null
          payment_method?: 'cash' | 'card' | null
          rating?: number | null
          rating_categories?: Json | null
          feedback?: string | null
          created_at?: string
          accepted_at?: string | null
          arrived_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          technician_id?: string | null
          status?: 'pending' | 'accepted' | 'on_way' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'
          photo_url?: string
          description?: string
          bike_type?: 'regular' | 'electric'
          category?: string
          estimated_price_min?: number
          estimated_price_max?: number
          customer_lat?: number
          customer_lng?: number
          customer_address?: string | null
          technician_lat?: number | null
          technician_lng?: number | null
          final_price?: number | null
          parts?: Json | null
          technician_notes?: string | null
          payment_method?: 'cash' | 'card' | null
          rating?: number | null
          rating_categories?: Json | null
          feedback?: string | null
          created_at?: string
          accepted_at?: string | null
          arrived_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'jobs_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jobs_technician_id_fkey'
            columns: ['technician_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      reviews: {
        Row: {
          id: string
          job_id: string
          customer_id: string
          technician_id: string
          rating: number
          categories: Json | null
          feedback: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          customer_id: string
          technician_id: string
          rating: number
          categories?: Json | null
          feedback?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          customer_id?: string
          technician_id?: string
          rating?: number
          categories?: Json | null
          feedback?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reviews_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_technician_id_fkey'
            columns: ['technician_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier access
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
