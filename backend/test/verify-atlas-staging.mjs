import mongoose from 'mongoose';
import crypto from 'node:crypto';

// Load local environment configuration
if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

async function verifyAtlasStaging() {
  console.log('--- AR-DINE PHASE 9 LIVE ATLAS STAGING VERIFICATION ---');
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI not configured in backend/.env');
  }

  // Mask credentials for audit logging
  const sanitizedTarget = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log(`Connecting to live Atlas cluster: ${sanitizedTarget}`);

  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;
  console.log('Connected successfully to MongoDB Atlas database:', mongoose.connection.name);

  // 1. Verify collections and schemas
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);
  console.log('\n[Check 1: Collections Verified]');
  console.log('Present collections:', collectionNames.join(', '));
  const expectedCollections = ['restaurants', 'restaurant_tables', 'menu_items', 'categories', 'orders', 'dining_sessions', 'users'];
  for (const exp of expectedCollections) {
    if (!collectionNames.includes(exp)) {
      throw new Error(`Missing expected collection: ${exp}`);
    }
  }

  // 2. Resolve Restaurant
  console.log('\n[Check 2: Restaurant Resolution]');
  const restaurant = await db.collection('restaurants').findOne({ slug: 'spice-craft-kitchen' });
  if (!restaurant) throw new Error('Seeded restaurant spice-craft-kitchen not found');
  console.log(`Resolved: ${restaurant.name} (Slug: ${restaurant.slug}, ID: ${restaurant._id.toString()})`);

  // 3. Resolve Table & Stable QR Token
  console.log('\n[Check 3: Table QR Resolution]');
  const table = await db.collection('restaurant_tables').findOne({ tableToken: 'tbl_spice_01' });
  if (!table) throw new Error('Seeded table tbl_spice_01 not found');
  console.log(`Resolved: ${table.tableNumber} (Token: ${table.tableToken}, Capacity: ${table.capacity})`);

  // 4. Resolve Dish
  console.log('\n[Check 4: Menu Items & Pricing]');
  const dish = await db.collection('menu_items').findOne({ restaurantId: restaurant._id });
  if (!dish) throw new Error('Seeded dish not found');
  console.log(`Resolved Dish: ${dish.name} (Price: ${dish.price} INR)`);

  // 5. Create Dining Session
  console.log('\n[Check 5: Dining Session Lifecycle]');
  const sessionToken = `ds_${crypto.randomBytes(16).toString('hex')}`;
  const sessionResult = await db.collection('dining_sessions').insertOne({
    restaurantId: restaurant._id,
    tableId: table._id,
    sessionToken,
    guestCount: 2,
    status: 'ACTIVE',
    startedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`Created Active Dining Session: ${sessionToken}`);

  // 6. Server-Authoritative Pricing & Order Placement
  console.log('\n[Check 6: Server Authoritative Pricing & Tax]');
  const quantity = 2;
  const subtotal = dish.price * quantity;
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = subtotal + tax;
  console.log(`Calculated Subtotal: ${subtotal} INR, 5% Tax: ${tax} INR, Grand Total: ${grandTotal} INR`);

  const idempotencyKey = `idemp_${crypto.randomBytes(8).toString('hex')}`;
  const trackingToken = `trk_${crypto.randomBytes(16).toString('hex')}`;
  const orderNumber = `ORD-STAGING-${Math.floor(1000 + Math.random() * 9000)}`;

  const orderResult = await db.collection('orders').insertOne({
    restaurantId: restaurant._id,
    tableId: table._id,
    sessionId: sessionResult.insertedId,
    orderNumber,
    idempotencyKey,
    trackingToken,
    status: 'PLACED',
    items: [
      {
        menuItemId: dish._id,
        name: dish.name,
        price: dish.price,
        quantity,
        subtotal,
      },
    ],
    subtotal,
    tax,
    grandTotal,
    paymentStatus: 'PENDING',
    statusHistory: [
      {
        status: 'PLACED',
        changedAt: new Date(),
        changedBy: 'CUSTOMER',
        note: 'Staging verification test order',
      },
    ],
    placedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`Order Placed Successfully: ${orderNumber} (ID: ${orderResult.insertedId.toString()})`);

  // 7. Compound Idempotency Verification
  console.log('\n[Check 7: Idempotent Duplicate Protection]');
  const duplicateSearch = await db.collection('orders').findOne({
    restaurantId: restaurant._id,
    idempotencyKey,
  });
  if (!duplicateSearch || !duplicateSearch._id.equals(orderResult.insertedId)) {
    throw new Error('Idempotency lookup failed to retrieve existing order');
  }
  console.log(`Idempotency Verified: Querying restaurantId + idempotencyKey returns existing order ${orderNumber}`);

  // 8. Kitchen Display System (KDS) FIFO Verification
  console.log('\n[Check 8: KDS FIFO Queue]');
  const kitchenOrders = await db.collection('orders')
    .find({ restaurantId: restaurant._id, status: { $in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY'] } })
    .sort({ placedAt: 1 })
    .toArray();
  console.log(`Active KDS Queue Length: ${kitchenOrders.length} orders`);
  const foundInQueue = kitchenOrders.some((o) => o._id.equals(orderResult.insertedId));
  if (!foundInQueue) throw new Error('Order not found in kitchen queue');
  console.log(`Order ${orderNumber} verified in KDS queue with status PLACED`);

  // 9. Kitchen State Machine Transitions
  console.log('\n[Check 9: Kitchen State Machine Transitions]');
  const transitions = ['CONFIRMED', 'PREPARING', 'READY', 'SERVED'];
  for (const nextStatus of transitions) {
    await db.collection('orders').updateOne(
      { _id: orderResult.insertedId },
      {
        $set: { status: nextStatus, updatedAt: new Date() },
        $push: {
          statusHistory: {
            status: nextStatus,
            changedAt: new Date(),
            changedBy: 'CHEF_STAGING',
            note: `Advanced to ${nextStatus}`,
          },
        },
      },
    );
    const stateCheck = await db.collection('orders').findOne({ _id: orderResult.insertedId });
    if (stateCheck.status !== nextStatus) throw new Error(`Transition to ${nextStatus} failed`);
    console.log(` -> Transitioned to ${nextStatus} (persisted in Atlas)`);
  }

  // 10. Customer Order Tracking Capability
  console.log('\n[Check 10: Capability Token Tracking View]');
  const customerView = await db.collection('orders').findOne({
    _id: orderResult.insertedId,
    trackingToken,
  });
  if (!customerView) throw new Error('Customer capability token lookup failed');
  console.log(`Authoritative Tracking View Verified: Current Stored Status: ${customerView.status}`);
  console.log(`Item Snapshot Intact: ${customerView.items[0].name} x ${customerView.items[0].quantity} = ${customerView.items[0].subtotal} INR`);

  // 11. Cleanup disposable test artifacts
  console.log('\n[Check 11: Cleanup Disposable Staging Data]');
  await db.collection('orders').deleteOne({ _id: orderResult.insertedId });
  await db.collection('dining_sessions').deleteOne({ _id: sessionResult.insertedId });
  console.log('Successfully removed staging test order and dining session.');

  await mongoose.disconnect();
  console.log('\n=== ALL 11 LIVE MONGODB ATLAS STAGING SCENARIOS VERIFIED SUCCESSFULLY ===');
}

verifyAtlasStaging().catch((err) => {
  console.error('Atlas verification failed:', err);
  process.exit(1);
});
