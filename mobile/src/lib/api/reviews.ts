import { Review } from '../types';
import { api } from './api';

export interface TechnicianReviewsResponse {
  reviews: Review[];
}

export async function getTechnicianReviews(technicianId: string): Promise<Review[]> {
  const data = await api.get<TechnicianReviewsResponse>(
    `/api/reviews/technician/${technicianId}`
  );
  return data.reviews ?? [];
}