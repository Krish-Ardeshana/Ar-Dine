import { Injectable, Logger, MessageEvent, UnauthorizedException } from '@nestjs/common';
import { filter, map, Observable, Subject } from 'rxjs';
import { OrderResponseDto } from './dto/order-response.dto.js';

export interface OrderEventPayload {
  type: 'ORDER_PLACED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED';
  restaurantId: string;
  orderNumber: string;
  trackingToken?: string;
  order: OrderResponseDto;
  timestamp: string;
}

@Injectable()
export class OrderEventsService {
  private readonly logger = new Logger(OrderEventsService.name);
  private readonly orderEvent$ = new Subject<OrderEventPayload>();

  /**
   * Emits an order event to active subscribers (KDS & Customer Tracking).
   */
  emitOrderEvent(
    type: 'ORDER_PLACED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED',
    order: OrderResponseDto,
    trackingTokenOverride?: string,
  ): void {
    const payload: OrderEventPayload = {
      type,
      restaurantId: order.restaurantId,
      orderNumber: order.orderNumber,
      trackingToken: trackingTokenOverride || order.trackingToken,
      order,
      timestamp: new Date().toISOString(),
    };
    this.logger.debug(
      `Emitting real-time ${type} for order ${order.orderNumber} in restaurant ${order.restaurantId}`,
    );
    this.orderEvent$.next(payload);
  }

  /**
   * Stream filtered specifically for a restaurant's Kitchen Display System (KDS).
   */
  streamForRestaurant(restaurantId: string): Observable<MessageEvent> {
    return this.orderEvent$.asObservable().pipe(
      filter((event) => event.restaurantId === restaurantId),
      map((event) => ({
        data: event,
        type: event.type,
      } as MessageEvent)),
    );
  }

  /**
   * Stream filtered specifically for a customer tracking session by orderNumber and trackingToken.
   * Enforces matching capability token so guests cannot spy on other orders.
   */
  streamForOrder(orderNumber: string, trackingToken: string): Observable<MessageEvent> {
    if (!trackingToken || trackingToken.trim().length === 0) {
      throw new UnauthorizedException('Order tracking stream requires a valid tracking token');
    }
    const cleanToken = trackingToken.trim();

    return this.orderEvent$.asObservable().pipe(
      filter(
        (event) =>
          event.orderNumber === orderNumber &&
          event.trackingToken === cleanToken,
      ),
      map((event) => ({
        data: event,
        type: event.type,
      } as MessageEvent)),
    );
  }
}
