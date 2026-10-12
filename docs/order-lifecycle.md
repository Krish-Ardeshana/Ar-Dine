# AR-DINE — Order Lifecycle State Machine Specification

## 1. Overview
The AR-DINE Order Lifecycle State Machine governs the authoritative progression of orders from guest submission to physical delivery at the table. All transitions are validated centrally by `OrdersService` and executed with atomic conditional updates in MongoDB to prevent race conditions.

---

## 2. Fulfillment Status Lifecycle

```
[PLACED] ──────> [CONFIRMED] ──────> [PREPARING] ──────> [READY] ──────> [SERVED]
    │                 │                   │
    └─────────────────┴───────────────────┴─────────> [CANCELLED]
```

### State Definitions
- **`PLACED`**: The order has been submitted by the customer and persisted in the database. Awaiting kitchen or restaurant staff acknowledgment.
- **`CONFIRMED`**: Restaurant or kitchen staff acknowledged and accepted the order into the preparation queue.
- **`PREPARING`**: Kitchen staff has actively started cooking/plating the dishes.
- **`READY`**: Food preparation is complete. Plated dishes are staged at the pass, awaiting server delivery.
- **`SERVED`**: Waiter or authorized staff confirmed physical delivery to the diner's table. Terminal fulfillment state.
- **`CANCELLED`**: The order was halted with recorded reason, actor, and timestamp. Terminal state.

---

## 3. Lifecycle Transition Matrix

| Source State | Target State | Permitted Actor Roles | Concurrency Guard |
| :--- | :--- | :--- | :--- |
| `PLACED` | `CONFIRMED` | `RESTAURANT_ADMIN`, `KITCHEN_STAFF`, `SUPER_ADMIN` | `{ _id, status: 'PLACED' }` |
| `CONFIRMED` | `PREPARING` | `RESTAURANT_ADMIN`, `KITCHEN_STAFF`, `SUPER_ADMIN` | `{ _id, status: 'CONFIRMED' }` |
| `PREPARING` | `READY` | `RESTAURANT_ADMIN`, `KITCHEN_STAFF`, `SUPER_ADMIN` | `{ _id, status: 'PREPARING' }` |
| `READY` | `SERVED` | `RESTAURANT_ADMIN`, `WAITER`, `SUPER_ADMIN` | `{ _id, status: 'READY' }` |
| `PLACED` | `CANCELLED` | `CUSTOMER` (via tracking token) OR authorized staff | `{ _id, status: 'PLACED' }` |
| `CONFIRMED` | `CANCELLED` | `RESTAURANT_ADMIN`, `KITCHEN_STAFF`, `SUPER_ADMIN` | `{ _id, status: 'CONFIRMED' }` |
| `PREPARING` | `CANCELLED` | `RESTAURANT_ADMIN`, `KITCHEN_STAFF`, `SUPER_ADMIN` | `{ _id, status: 'PREPARING' }` |
| `READY` | *Any* | **None** (Terminal, cancellation blocked) | — |
| `SERVED` | *Any* | **None** (Terminal, immutable) | — |
| `CANCELLED`| *Any* | **None** (Terminal, immutable) | — |

---

## 4. Separation of Payment Status from Fulfillment Status

Payment status is strictly decoupled from kitchen fulfillment. Advancing an order through `PLACED` → `CONFIRMED` → `PREPARING` → `READY` → `SERVED` does **not** alter payment status.

- `PENDING`: Default payment status upon guest order placement. Remains `PENDING` throughout Phase 6 (no simulated payment gateways).
- `PAID`: Reserved for future payment gateway settlement phases.
- `FAILED`: Reserved for rejected payment attempts.

---

## 5. Cancellation Policy & Concurrency Protection

### Customer Cancellation
- Diners may cancel their order **only** while it remains in `PLACED` status.
- Once staff accepts the ticket (`CONFIRMED`) or starts cooking (`PREPARING`), guest cancellation is rejected (`400 Bad Request`) to avoid food waste.
- Requires valid `trackingToken` query parameter.

### Staff Cancellation
- Authorized staff may cancel orders in `PLACED`, `CONFIRMED`, or `PREPARING` states with a required reason.
- Orders in `READY` or `SERVED` states cannot be cancelled via standard workflow.

### Concurrency Protection
All status updates employ atomic MongoDB `findOneAndUpdate` with optimistic status preconditions:
```typescript
const updated = await this.orderModel.findOneAndUpdate(
  { _id: orderId, restaurantId, status: currentStatus },
  { $set: updateFields },
  { new: true }
);
if (!updated) {
  throw new ConflictException('Order status was modified concurrently');
}
```
If two staff members or a customer cancel attempt races with a kitchen confirmation, exactly one transaction succeeds while the other is rejected with a `409 Conflict`.
