# AR-DINE — Real-Time Order Synchronization Specification

## 1. Architecture
AR-DINE implements real-time order synchronization using native NestJS Server-Sent Events (SSE) powered by RxJS `Subject` and reactive stream filters. This provides low-latency, HTTP/2-friendly push notifications without requiring complex external brokers like Redis or Socket.io.

```
       [Customer Order Event]
                 │
                 ▼
       [OrdersService (DB Write)]
                 │
                 ▼ (After DB commit)
       [OrderEventsService.emitOrderEvent]
                 │
      ┌──────────┴──────────┐
      ▼                     ▼
[Kitchen SSE Stream]    [Customer Tracking SSE]
  (Tenant-Filtered)       (Order & Token Filtered)
```

---

## 2. Event Payload Structure
All events emitted over the SSE transport adhere to the following payload schema:

```typescript
export interface OrderEventPayload {
  type: 'ORDER_PLACED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED';
  restaurantId: string;
  orderNumber: string;
  trackingToken?: string;
  order: OrderResponseDto;
  timestamp: string;
}
```

---

## 3. Stream Endpoints & Authorization

### 3.1 Kitchen Display Stream
- **URL**: `GET /api/v1/restaurants/:restaurantId/orders/events`
- **Auth**: Protected by `JwtAuthGuard` and `RolesGuard`. Requires restaurant membership with `RESTAURANT_ADMIN`, `KITCHEN_STAFF`, or `WAITER` role.
- **Filtering**: RxJS filter ensures events are emitted only when `event.restaurantId === restaurantId`. Cross-tenant data leakage is strictly prevented.

### 3.2 Customer Tracking Stream
- **URL**: `GET /api/v1/restaurants/public/:slug/orders/:orderReference/events?token=:trackingToken`
- **Auth**: Capability-protected by opaque, high-entropy `trackingToken`.
- **Filtering**: RxJS filter matches both `event.orderNumber === orderReference` and `event.trackingToken === trackingToken`. Diners cannot intercept events for other tables.

---

## 4. Intelligent Polling Fallback
To ensure complete reliability in environments with aggressive proxy buffering, mobile sleep, or flaky networks:
1. Both the KDS and Customer Tracking page establish an `EventSource` connection.
2. If `EventSource.onerror` triggers, the client gracefully transitions the UI status badge to `"Live Polling (5s)"`.
3. An active `visibilitychange` listener pauses polling when the browser tab is hidden/backgrounded and triggers an immediate authoritative state refresh as soon as the tab becomes visible again.
4. Manual refresh buttons are always available to re-query the latest server truth.
