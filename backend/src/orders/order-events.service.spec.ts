import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { OrderResponseDto } from './dto/order-response.dto.js';
import { OrderEventsService } from './order-events.service.js';

describe('OrderEventsService', () => {
  const service = new OrderEventsService();

  const mockOrder: OrderResponseDto = {
    id: '6709b1a2c3d4e5f6a7b8c9d0',
    restaurantId: 'rest_tenant_alpha',
    tableId: 'table_1',
    tableNumber: 'Table 1',
    orderNumber: 'ORD-20261012-001',
    trackingToken: 'trk_alpha_secret_token_123',
    items: [],
    subtotal: 500,
    taxAmount: 25,
    discountAmount: 0,
    grandTotal: 525,
    status: 'PLACED' as any,
    paymentStatus: 'PENDING' as any,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('delivers events to authorized restaurant KDS subscribers and isolates other tenants', async () => {
    const receivedAlpha: any[] = [];
    const receivedBeta: any[] = [];

    const subAlpha = service.streamForRestaurant('rest_tenant_alpha').subscribe((msg) => {
      receivedAlpha.push(msg.data);
    });

    const subBeta = service.streamForRestaurant('rest_tenant_beta').subscribe((msg) => {
      receivedBeta.push(msg.data);
    });

    service.emitOrderEvent('ORDER_PLACED', mockOrder);

    expect(receivedAlpha).toHaveLength(1);
    expect(receivedAlpha[0].orderNumber).toBe('ORD-20261012-001');
    expect(receivedBeta).toHaveLength(0); // Tenant isolation: Beta receives nothing

    subAlpha.unsubscribe();
    subBeta.unsubscribe();
  });

  it('delivers events to customer tracking stream when orderNumber and trackingToken match', async () => {
    const receivedCustomer: any[] = [];

    const sub = service
      .streamForOrder('ORD-20261012-001', 'trk_alpha_secret_token_123')
      .subscribe((msg) => {
        receivedCustomer.push(msg.data);
      });

    service.emitOrderEvent('ORDER_UPDATED', mockOrder);

    expect(receivedCustomer).toHaveLength(1);
    expect(receivedCustomer[0].order.orderNumber).toBe('ORD-20261012-001');

    sub.unsubscribe();
  });

  it('blocks customer tracking stream when trackingToken does not match', async () => {
    const receivedCustomer: any[] = [];

    const sub = service
      .streamForOrder('ORD-20261012-001', 'trk_wrong_impostor_token')
      .subscribe((msg) => {
        receivedCustomer.push(msg.data);
      });

    service.emitOrderEvent('ORDER_UPDATED', mockOrder);

    expect(receivedCustomer).toHaveLength(0); // Impostor receives no events!

    sub.unsubscribe();
  });

  it('rejects subscription attempt without tracking token with UnauthorizedException', () => {
    expect(() => service.streamForOrder('ORD-20261012-001', '')).toThrow(
      UnauthorizedException,
    );
    expect(() => service.streamForOrder('ORD-20261012-001', '   ')).toThrow(
      UnauthorizedException,
    );
  });
});
