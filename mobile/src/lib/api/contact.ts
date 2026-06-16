import { RepairRequest } from '../types';
import * as FileSystem from 'expo-file-system/legacy';

export async function sendDetailsToRepresentative(
  request: RepairRequest,
  location?: { latitude: number; longitude: number; address?: string },
  customerInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  }
) {
  try {
    // Convert image to base64 if photo_uri exists
    let photoBase64 = null;
    if (request.photo_uri) {
      try {
        const base64 = await FileSystem.readAsStringAsync(request.photo_uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        photoBase64 = base64;
      } catch (error) {
        console.error('Error converting image to base64:', error);
      }
    }

    const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/contact/send-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        photo_uri: request.photo_uri,
        photo_base64: photoBase64,
        description: request.description,
        bike_type: request.bike_type,
        category: request.categories[0],
        location,
        customer_name: customerInfo?.name,
        customer_phone: customerInfo?.phone,
        customer_email: customerInfo?.email,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending details to representative:', error);
    throw error;
  }
}
