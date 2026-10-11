import {
  OperationalStatus,
  PublicationStatus,
} from '../../database/schemas/restaurant.schema.js';

export class RestaurantResponseDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  contact: {
    email: string;
    phone: string;
    website?: string;
  };
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  ownerId?: string;
  publicationStatus: PublicationStatus;
  operationalStatus: OperationalStatus;
  currency: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PublicRestaurantDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  contact: {
    email: string;
    phone: string;
    website?: string;
  };
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  operationalStatus: OperationalStatus;
  currency: string;
  timezone: string;
}
