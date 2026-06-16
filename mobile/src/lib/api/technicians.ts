import { TechnicianProfile, Location } from '../types';
import { api } from './api';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

export interface TechnicianWithDistance extends TechnicianProfile {
  distance: number;
  eta: number;
}

export interface GetAvailableTechniciansResponse {
  technicians: TechnicianWithDistance[];
}

export interface GetTechnicianResponse {
  technician: TechnicianProfile;
}

export async function getAvailableTechnicians(
  customerLocation?: Location
): Promise<TechnicianWithDistance[]> {
  try {
    let url = `/api/technicians/available`;

    if (customerLocation) {
      url += `?lat=${customerLocation.latitude}&lng=${customerLocation.longitude}`;
    }

    const data = await api.get<GetAvailableTechniciansResponse>(url);

    // Map backend fields to frontend TechnicianProfile type
    return data.technicians.map((tech: any) => ({
      id: tech.id,
      name: tech.name,
      email: tech.email,
      phone: tech.phone,
      avatar_url: tech.image,
      role: 'technician' as const,
      bio: tech.bio,
      rating: tech.rating || 0,
      total_reviews: tech.totalReviews || 0,
      verification_status: tech.isApproved ? 'verified' : 'pending',
      vehicle_type: tech.vehicleType,
      service_radius: tech.serviceRadius || 15,
      is_available: tech.isAvailable || false,
      current_location: tech.currentLocationLat && tech.currentLocationLng ? {
        latitude: tech.currentLocationLat,
        longitude: tech.currentLocationLng,
      } : undefined,
      base_price: tech.basePrice || 50,
      total_earnings: tech.totalEarnings || 0,
      created_at: tech.createdAt,
      updated_at: tech.updatedAt,
      distance: tech.distance,
      eta: tech.eta,
    }));
  } catch (error) {
    console.error('Error fetching available technicians:', error);
    throw error;
  }
}

export async function getTechnicianById(id: string): Promise<TechnicianProfile> {
  try {
    const response = await fetch(`${API_URL}/api/technicians/${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch technician');
    }

    const data: GetTechnicianResponse = await response.json();
    const tech = data.technician as any;

    // Map backend fields to frontend TechnicianProfile type
    return {
      id: tech.id,
      name: tech.name,
      email: tech.email,
      phone: tech.phone,
      avatar_url: tech.image,
      role: 'technician' as const,
      bio: tech.bio,
      rating: tech.rating || 0,
      total_reviews: tech.totalReviews || 0,
      verification_status: tech.isApproved ? 'verified' : 'pending',
      vehicle_type: tech.vehicleType,
      service_radius: tech.serviceRadius || 15,
      is_available: tech.isAvailable || false,
      current_location: tech.currentLocationLat && tech.currentLocationLng ? {
        latitude: tech.currentLocationLat,
        longitude: tech.currentLocationLng,
      } : undefined,
      base_price: tech.basePrice || 50,
      total_earnings: tech.totalEarnings || 0,
      created_at: tech.createdAt,
      updated_at: tech.updatedAt,
    };
  } catch (error) {
    console.error('Error fetching technician:', error);
    throw error;
  }
}

export async function updateTechnicianProfile(
  data: Partial<TechnicianProfile>,
  token?: string
): Promise<TechnicianProfile> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/api/technicians/profile`, {
      method: 'PATCH',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        phone: data.phone,
        bio: data.bio,
        vehicleType: data.vehicle_type,
        serviceRadius: data.service_radius,
        isAvailable: data.is_available,
        currentLocationLat: data.current_location?.latitude,
        currentLocationLng: data.current_location?.longitude,
        basePrice: data.base_price,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update technician profile');
    }

    const result: GetTechnicianResponse = await response.json();
    const tech = result.technician as any;

    return {
      id: tech.id,
      name: tech.name,
      email: tech.email,
      phone: tech.phone,
      avatar_url: tech.image,
      role: 'technician' as const,
      bio: tech.bio,
      rating: tech.rating || 0,
      total_reviews: tech.totalReviews || 0,
      verification_status: tech.isApproved ? 'verified' : 'pending',
      vehicle_type: tech.vehicleType,
      service_radius: tech.serviceRadius || 15,
      is_available: tech.isAvailable || false,
      current_location: tech.currentLocationLat && tech.currentLocationLng ? {
        latitude: tech.currentLocationLat,
        longitude: tech.currentLocationLng,
      } : undefined,
      base_price: tech.basePrice || 50,
      total_earnings: tech.totalEarnings || 0,
      created_at: tech.createdAt,
      updated_at: tech.updatedAt,
    };
  } catch (error) {
    console.error('Error updating technician profile:', error);
    throw error;
  }
}

export async function updateTechnicianAvailability(
  isAvailable: boolean,
  token?: string
): Promise<void> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/api/technicians/availability`, {
      method: 'PATCH',
      headers,
      credentials: 'include',
      body: JSON.stringify({ isAvailable }),
    });

    if (!response.ok) {
      throw new Error('Failed to update availability');
    }
  } catch (error) {
    console.error('Error updating technician availability:', error);
    throw error;
  }
}

export async function updateTechnicianLocation(
  location: Location,
  token?: string
): Promise<void> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/api/technicians/location`, {
      method: 'PATCH',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        lat: location.latitude,
        lng: location.longitude,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update location');
    }
  } catch (error) {
    console.error('Error updating technician location:', error);
    throw error;
  }
}
