# AR-DINE — Order & Kitchen API Documentation

All order endpoints are prefixed with `/api/v1`.

---

## 1. Public Guest Endpoints

### 1.1 Place Order
- **Route:** `POST /restaurants/public/:slug/tables/:tableToken/orders`
- **Auth:** Public (`@Public()`)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "sessionToken": "ds_a1b2c3d4e5f6g7h8",
  "items": [
    {
      "menuItemId": "6640a1b2c3d4e5f6a7b8c9d0",
      "quantity": 2,
      "specialInstructions": "Extra sauce, mild spice"
    }
  ],
  "idempotencyKey": "idemp_ds_a1b2c3d4e5f6g7h8_1760000000000"
}
```
- **Response (201 Created):**
```json
{
  "id": "6709b1a2c3d4e5f6a7b8c9d0",
  "restaurantId": "6640a1b2c3d4e5f6a7b8c9aa",
  "tableId": "6640a1b2c3d4e5f6a7b8c9bb",
  "tableNumber": "Table 5",
  "diningSessionId": "6640a1b2c3d4e5f6a7b8c9cc",
  "orderNumber": "ORD-20261012-7F3A",
  "trackingToken": "trk_4a8b7c1d2e3f4a5b6c7d8e9f0a1b2c3d",
  "items": [
    {
      "menuItemId": "6640a1b2c3d4e5f6a7b8c9d0",
      "name": "Truffle Pasta",
      "unitPrice": 450,
      "quantity": 2,
      "subtotal": 900,
      "specialInstructions": "Extra sauce, mild spice"
    }
  ],
  "subtotal": 900,
  "taxAmount": 45,
  "discountAmount": 0,
  "grandTotal": 945,
  "status": "PLACED",
  "paymentStatus": "PENDING",
  "placedAt": "2026-10-12T05:20:00.000Z",
  "createdAt": "2026-10-12T05:20:00.000Z",
  "updatedAt": "2026-10-12T05:20:00.000Z"
}
```

### 1.2 Get Public Order Tracking
- **Route:** `GET /restaurants/public/:slug/orders/:orderReference?token=:trackingToken`
- **Auth:** Public (`@Public()`), capability-protected by high-entropy `trackingToken`
- **Response (200 OK):** `OrderResponseDto` (same format as above)
- **Errors:**
  - `401 Unauthorized`: Missing `token` query parameter
  - `403 Forbidden`: Mismatched `trackingToken`
  - `404 Not Found`: Unknown order reference or slug

### 1.3 Cancel Public Order
- **Route:** `POST /restaurants/public/:slug/orders/:orderReference/cancel?token=:trackingToken`
- **Auth:** Public (`@Public()`), capability-protected by `trackingToken`
- **Request Body:**
```json
{
  "reason": "Customer changed mind before preparation"
}
```
- **Response (200 OK):** Updated `OrderResponseDto` with `status: "CANCELLED"`
- **Errors:**
  - `400 Bad Request`: Order is no longer in `PLACED` status
  - `409 Conflict`: Order was transitioned concurrently

### 1.4 Customer Real-Time SSE Stream
- **Route:** `GET /restaurants/public/:slug/orders/:orderReference/events?token=:trackingToken`
- **Transport:** Server-Sent Events (`text/event-stream`)
- **Events Emitted:** `ORDER_UPDATED`, `ORDER_CANCELLED`

---

## 2. Staff & KDS Endpoints

### 2.1 Get Kitchen Queue (FIFO)
- **Route:** `GET /restaurants/:restaurantId/orders/kitchen`
- **Auth:** Bearer JWT, `@RequireRestaurantRole([RESTAURANT_ADMIN, KITCHEN_STAFF, WAITER])`
- **Header:** `x-restaurant-id: :restaurantId`
- **Response (200 OK):** Array of active orders in FIFO order (`placedAt: 1`) where `status IN ['PLACED', 'CONFIRMED', 'PREPARING', 'READY']`. Omit sensitive tracking tokens.

### 2.2 List Restaurant Orders
- **Route:** `GET /restaurants/:restaurantId/orders?status=:status&limit=:limit`
- **Auth:** Bearer JWT, `@RequireRestaurantRole([RESTAURANT_ADMIN, KITCHEN_STAFF, WAITER])`

### 2.3 Get Order by ID
- **Route:** `GET /restaurants/:restaurantId/orders/:orderId`
- **Auth:** Bearer JWT, Tenant-isolated

### 2.4 Update Order Status (State Machine Transition)
- **Route:** `PATCH /restaurants/:restaurantId/orders/:orderId/status`
- **Auth:** Bearer JWT, `@RequireRestaurantRole([RESTAURANT_ADMIN, KITCHEN_STAFF, WAITER])`
- **Request Body:**
```json
{
  "status": "PREPARING"
}
```
- **Response (200 OK):** Updated `OrderResponseDto`
- **Errors:**
  - `400 Bad Request`: Illegal status jump (e.g. `PLACED` -> `SERVED`)
  - `403 Forbidden`: Unauthorized role transition (e.g. Waiter trying to start prep, or Kitchen staff trying to mark served)
  - `409 Conflict`: Concurrent update detected

### 2.5 Cancel Order (Staff)
- **Route:** `POST /restaurants/:restaurantId/orders/:orderId/cancel`
- **Auth:** Bearer JWT, `@RequireRestaurantRole([RESTAURANT_ADMIN, KITCHEN_STAFF, WAITER])`
- **Request Body:**
```json
{
  "reason": "Ingredient 86'd mid-shift"
}
```

### 2.6 Kitchen Real-Time SSE Stream
- **Route:** `GET /restaurants/:restaurantId/orders/events`
- **Transport:** Server-Sent Events (`text/event-stream`)
- **Auth:** Bearer JWT, Tenant-scoped to `:restaurantId`
- **Events Emitted:** `ORDER_PLACED`, `ORDER_UPDATED`, `ORDER_CANCELLED`
