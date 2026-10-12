# AR-DINE — Kitchen Display System (KDS) Workflow

## 1. Overview
The Kitchen Display System (KDS) provides back-of-house kitchen staff and restaurant management with an operational dashboard for managing ticket queues, monitoring prep times, and advancing order statuses.

The KDS is accessible at:
`/dashboard/kitchen`

---

## 2. Queue Ordering and Filtering
- **FIFO Sorting**: Tickets are strictly sorted in First-In, First-Out order (`placedAt: 1`), ensuring oldest tickets are addressed first.
- **Filter Tabs**:
  - `All Active`: All non-terminal tickets currently requiring kitchen or service attention.
  - `Incoming` (`PLACED`): Tickets placed by guests that need kitchen confirmation.
  - `Accepted` (`CONFIRMED`): Confirmed tickets ready to enter the cooking line.
  - `Cooking` (`PREPARING`): Actively cooking orders.
  - `Ready to Serve` (`READY`): Plated orders waiting at the pass for waitstaff.

---

## 3. Ticket Card Visual Distinctions
Each ticket displays:
1. **Header**:
   - Order Number (e.g. `ORD-20261012-7F3A`)
   - Table Number (e.g. `Table 5`)
   - Elapsed Time Badge:
     - Normal (`< 15 min`): Neutral badge
     - Urgent (`>= 15 min`): Red pulsating border and alert badge
2. **Item List**:
   - Bold item quantities (`2x`) and dish names.
   - Special instructions / dietary modifications prominently highlighted in amber callout boxes.
3. **Action Button**:
   - Dynamic button rendered according to the permitted state machine transition for the order's current status:
     - `PLACED`: **✓ Accept & Confirm** (moves to `CONFIRMED`)
     - `CONFIRMED`: **🔥 Start Cooking (Prep)** (moves to `PREPARING`)
     - `PREPARING`: **🔔 Mark Order Ready** (moves to `READY`)
     - `READY`: **🍽️ Confirm Served** (moves to `SERVED`, removing ticket from active queue)
   - **Cancel Ticket** button: Opens staff cancellation reason modal.

---

## 4. Multi-Tenant Restaurant Switching
Kitchen staff with access to multiple restaurant venues can switch active kitchens using the top-level restaurant selector dropdown. Switching immediately repoints the active queue query and real-time SSE stream.
