import { DHLApiResponse, DHLShipment } from '../types';

// DHL API Configuration
const DHL_API_KEY = 'mLG4tKn8BRN9NAdRHtFOCqgIqEzUsaOb';
const DHL_API_SECRET = 'AWfxlBqrV2DPLIb3'; // Kept for reference, but unused for Unified API public access
const DHL_API_URL = 'https://api-eu.dhl.com/track/shipments';

export const trackShipment = async (trackingNumber: string): Promise<DHLShipment> => {
  if (!trackingNumber) {
    throw new Error("Tracking number is required");
  }

  // Create an abort controller for timeout handling (15 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const headers = new Headers();
    headers.set('Accept', 'application/json');
    headers.set('DHL-API-Key', DHL_API_KEY); 
    
    // NOTE: We have removed the 'Authorization' header. 
    // The DHL Unified Tracking API (api-eu.dhl.com) typically uses the DHL-API-Key header for identification.
    // Sending both Basic Auth and API Key headers often confuses the Gateway, leading to 504 Timeouts.
    // headers.set('Authorization', 'Basic ' + btoa(`${DHL_API_KEY}:${DHL_API_SECRET}`));

    const response = await fetch(`${DHL_API_URL}?trackingNumber=${trackingNumber}`, {
      method: 'GET',
      headers: headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Shipment not found. Please check the AWB number.");
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed. The API Key may be restricted.");
      }
      if (response.status === 504) {
        throw new Error("DHL Gateway Timeout. The server did not respond in time.");
      }
      if (response.status === 429) {
        throw new Error("Too many requests. Please try again later.");
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: DHLApiResponse = await response.json();
    
    if (!data.shipments || data.shipments.length === 0) {
      throw new Error("No shipment data found in response.");
    }

    return data.shipments[0];
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("DHL Tracking Error:", error);
    
    if (error.name === 'AbortError') {
      throw new Error("Request timed out. The DHL API is taking too long to respond.");
    }
    if (error.message.includes("Failed to fetch")) {
        throw new Error("Network connection failed. This is likely a browser CORS restriction on the DHL API.");
    }
    
    throw error;
  }
};

// Mock data for demo purposes if API fails
export const getMockShipment = (trackingNumber: string): DHLShipment => {
  return {
    id: trackingNumber,
    service: 'EXPRESS WORLDWIDE',
    origin: {
      address: { countryCode: 'DE', postalCode: '12345', addressLocality: 'Berlin' }
    },
    destination: {
      address: { countryCode: 'ID', postalCode: '10110', addressLocality: 'Jakarta' }
    },
    status: {
      timestamp: new Date().toISOString(),
      location: { address: { addressLocality: 'Jakarta Gateway' } },
      statusCode: 'pre-transit',
      status: 'TRANSIT',
      description: 'Shipment has departed from a DHL facility'
    },
    details: {
      product: { productName: 'DHL EXPRESS WORLDWIDE' },
      weight: { value: 2.5, unitText: 'KG' }
    },
    events: [
      {
        date: '2023-10-27',
        time: '10:30:00',
        typeCode: 'OK',
        description: 'Delivered - Signed for by: BUDI',
        serviceArea: [{ code: 'JKT', description: 'Jakarta - Indonesia' }],
        signedBy: 'BUDI'
      },
      {
        date: '2023-10-27',
        time: '08:15:00',
        typeCode: 'WC',
        description: 'With delivery courier',
        serviceArea: [{ code: 'JKT', description: 'Jakarta - Indonesia' }]
      },
      {
        date: '2023-10-26',
        time: '15:45:00',
        typeCode: 'PL',
        description: 'Processed at Jakarta - Indonesia',
        serviceArea: [{ code: 'JKT', description: 'Jakarta - Indonesia' }]
      },
      {
        date: '2023-10-25',
        time: '09:00:00',
        typeCode: 'DF',
        description: 'Departed Facility in Leipzig - Germany',
        serviceArea: [{ code: 'LEJ', description: 'Leipzig - Germany' }]
      }
    ]
  };
};