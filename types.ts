
export interface DHLEvent {
  date: string;
  time: string;
  typeCode: string;
  description: string;
  serviceArea: {
    code: string;
    description: string;
  }[];
  signedBy?: string;
  timestamp?: string;
}

export interface DHLOriginDestination {
  address: {
    countryCode: string;
    postalCode: string;
    addressLocality: string;
  };
}

export interface DHLShipment {
  id: string;
  service: string;
  origin: DHLOriginDestination;
  destination: DHLOriginDestination;
  status: {
    timestamp: string;
    location: {
      address: {
        addressLocality: string;
      };
    };
    statusCode: string;
    status: string;
    description: string;
  };
  events: DHLEvent[];
  details?: {
    product?: {
      productName?: string;
    };
    weight?: {
      value: number;
      unitText: string;
    };
  };
}

// Extended interface for local app state
export interface TrackedShipment extends DHLShipment {
  pic: string[];         // Person In Charge (Array of names)
  isCollected: boolean;  // Has the item been collected internally?
  collectedAt?: string;  // Timestamp of collection
}

export interface DHLApiResponse {
  shipments: DHLShipment[];
}

export interface AppError {
  message: string;
  details?: string;
}

// New Types for Activity Log
export type LogAction = 'ADD_SHIPMENT' | 'DELETE_SHIPMENT' | 'UPDATE_STATUS' | 'ADD_PIC' | 'REMOVE_PIC' | 'MARK_COLLECTED' | 'MARK_UNCOLLECTED' | 'BULK_UPDATE';

export interface LogEntry {
  id: string;
  timestamp: string;
  action: LogAction;
  description: string;
  relatedShipmentId?: string;
}
