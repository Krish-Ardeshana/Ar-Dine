import { SessionStatus } from '../../database/schemas/dining-session.schema.js';

export class SessionResponseDto {
  id: string;
  sessionToken: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  restaurantName: string;
  restaurantSlug: string;
  status: SessionStatus;
  expiresAt: Date;
  createdAt: Date;
}
