export enum PublicationStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum OperationalStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  PAUSED = 'PAUSED',
}

export interface ContactInfo {
  email: string;
  phone: string;
  website?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  contact: ContactInfo;
  address: Address;
  ownerId?: string;
  publicationStatus: PublicationStatus;
  operationalStatus: OperationalStatus;
  currency: string;
  timezone: string;
  createdAt?: string;
  updatedAt?: string;
}
