import mongoose from 'mongoose';
import {
  CategorySchema,
  MenuItemSchema,
  OperationalStatus,
  PublicationStatus,
  RestaurantSchema,
  RestaurantTableSchema,
  TableStatus,
  UserRole,
  UserSchema,
} from './schemas/index.js';

/**
 * Deterministic Development Seed Script
 * Strictly safe for local and staging environments.
 * Idempotent: multiple executions upsert without duplicating records.
 */
async function runSeed() {
  // Automatically load local .env file if available
  try {
    if (typeof (process as any).loadEnvFile === 'function') {
      (process as any).loadEnvFile('.env');
    }
  } catch {
    // Ignore if .env is missing or already set in shell
  }

  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'production') {
    console.error('CRITICAL: Seed execution is strictly prohibited when NODE_ENV=production');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || mongoUri.trim().length === 0) {
    console.error('ERROR: MONGODB_URI environment variable is required to run the seed script.');
    console.error('Please configure MONGODB_URI in backend/.env before running npm run seed.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB for deterministic seeding...');
  await mongoose.connect(mongoUri);

  try {
    const UserModel = mongoose.model('User', UserSchema);
    const RestaurantModel = mongoose.model('Restaurant', RestaurantSchema);
    const CategoryModel = mongoose.model('Category', CategorySchema);
    const MenuItemModel = mongoose.model('MenuItem', MenuItemSchema);
    const TableModel = mongoose.model('RestaurantTable', RestaurantTableSchema);

    console.log('1. Seeding System Super Admin...');
    const superAdmin = await UserModel.findOneAndUpdate(
      { email: 'superadmin@ardine.internal' },
      {
        $set: {
          name: 'Platform Super Admin',
          email: 'superadmin@ardine.internal',
          accountStatus: 'ACTIVE',
          globalRoles: [UserRole.SUPER_ADMIN],
          memberships: [],
        },
      },
      { upsert: true, new: true },
    );

    console.log('2. Seeding Restaurant 1: Spice Craft Kitchen...');
    const spiceCraft = await RestaurantModel.findOneAndUpdate(
      { slug: 'spice-craft-kitchen' },
      {
        $set: {
          name: 'Spice Craft Kitchen',
          slug: 'spice-craft-kitchen',
          description: 'Contemporary North Indian dining with authentic tandoor and 3D preview delicacies.',
          contact: {
            email: 'contact@spicecraft.internal',
            phone: '+91 98765 43210',
            website: 'https://spicecraft.internal',
          },
          address: {
            street: '42 Heritage Boulevard',
            city: 'Ahmedabad',
            state: 'Gujarat',
            postalCode: '380015',
            country: 'India',
          },
          ownerId: superAdmin._id,
          publicationStatus: PublicationStatus.PUBLISHED,
          operationalStatus: OperationalStatus.OPEN,
          currency: 'INR',
          timezone: 'Asia/Kolkata',
        },
      },
      { upsert: true, new: true },
    );

    console.log('3. Seeding Restaurant 2: Green Leaf Bistro...');
    const greenLeaf = await RestaurantModel.findOneAndUpdate(
      { slug: 'green-leaf-bistro' },
      {
        $set: {
          name: 'Green Leaf Bistro',
          slug: 'green-leaf-bistro',
          description: 'Farm-to-table organic bowls, artisan salads, and cold-pressed botanical blends.',
          contact: {
            email: 'hello@greenleaf.internal',
            phone: '+91 91234 56789',
            website: 'https://greenleaf.internal',
          },
          address: {
            street: '18 Eco Promenade',
            city: 'Bengaluru',
            state: 'Karnataka',
            postalCode: '560034',
            country: 'India',
          },
          ownerId: superAdmin._id,
          publicationStatus: PublicationStatus.PUBLISHED,
          operationalStatus: OperationalStatus.OPEN,
          currency: 'INR',
          timezone: 'Asia/Kolkata',
        },
      },
      { upsert: true, new: true },
    );

    console.log('4. Seeding Staff Memberships...');
    await UserModel.findOneAndUpdate(
      { email: 'manager.spicecraft@ardine.internal' },
      {
        $set: {
          name: 'Rajesh Sharma (Spice Manager)',
          email: 'manager.spicecraft@ardine.internal',
          accountStatus: 'ACTIVE',
          globalRoles: [UserRole.CUSTOMER],
          memberships: [
            {
              restaurantId: spiceCraft._id,
              roles: [UserRole.RESTAURANT_ADMIN],
            },
          ],
        },
      },
      { upsert: true, new: true },
    );

    console.log('5. Seeding Categories for Spice Craft Kitchen...');
    const startersCategory = await CategoryModel.findOneAndUpdate(
      { restaurantId: spiceCraft._id, name: 'Tandoori Starters' },
      {
        $set: {
          restaurantId: spiceCraft._id,
          name: 'Tandoori Starters',
          description: 'Clay-oven roasted appetizers marinated in fresh spices.',
          displayOrder: 1,
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true },
    );

    const mainsCategory = await CategoryModel.findOneAndUpdate(
      { restaurantId: spiceCraft._id, name: 'Royal Curries' },
      {
        $set: {
          restaurantId: spiceCraft._id,
          name: 'Royal Curries',
          description: 'Slow-simmered rich curries prepared with organic ingredients.',
          displayOrder: 2,
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true },
    );

    console.log('6. Seeding Menu Items with 3D/AR Metadata for Spice Craft Kitchen...');
    await MenuItemModel.findOneAndUpdate(
      { restaurantId: spiceCraft._id, slug: 'paneer-tikka-angara' },
      {
        $set: {
          restaurantId: spiceCraft._id,
          categoryId: startersCategory._id,
          slug: 'paneer-tikka-angara',
          name: 'Paneer Tikka Angara',
          description: 'Charcoal-smoked cottage cheese cubes skewered with crisp peppers and onions.',
          price: 340,
          availabilityStatus: 'AVAILABLE',
          publicationStatus: 'PUBLISHED',
          image: {
            url: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=800&q=80',
            altText: 'Paneer Tikka Angara on platter',
          },
          model3d: {
            glbUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
            format: 'glb',
            polyCount: 42000,
            fileSizeBytes: 2840000,
          },
          dietary: {
            isVegetarian: true,
            isVegan: false,
            isGlutenFree: true,
            spiceLevel: 'MEDIUM',
            allergens: ['Dairy'],
          },
          preparationTimeMinutes: 20,
        },
      },
      { upsert: true, new: true },
    );

    await MenuItemModel.findOneAndUpdate(
      { restaurantId: spiceCraft._id, slug: 'dal-makhani-shahi' },
      {
        $set: {
          restaurantId: spiceCraft._id,
          categoryId: mainsCategory._id,
          slug: 'dal-makhani-shahi',
          name: 'Dal Makhani Shahi',
          description: 'Black lentils slow cooked overnight on charcoal embers with churned butter and cream.',
          price: 380,
          availabilityStatus: 'AVAILABLE',
          publicationStatus: 'PUBLISHED',
          image: {
            url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
            altText: 'Dal Makhani Shahi in copper bowl',
          },
          dietary: {
            isVegetarian: true,
            isVegan: false,
            isGlutenFree: true,
            spiceLevel: 'MILD',
            allergens: ['Dairy'],
          },
          preparationTimeMinutes: 15,
        },
      },
      { upsert: true, new: true },
    );

    console.log('7. Seeding Tables with Immutable QR Tokens for Spice Craft Kitchen...');
    await TableModel.findOneAndUpdate(
      { tableToken: 'tbl_spice_01' },
      {
        $set: {
          restaurantId: spiceCraft._id,
          tableNumber: 'Table 1',
          tableToken: 'tbl_spice_01',
          capacity: 4,
          operationalStatus: TableStatus.AVAILABLE,
        },
      },
      { upsert: true, new: true },
    );

    await TableModel.findOneAndUpdate(
      { tableToken: 'tbl_spice_02' },
      {
        $set: {
          restaurantId: spiceCraft._id,
          tableNumber: 'Table 2 (Window)',
          tableToken: 'tbl_spice_02',
          capacity: 6,
          operationalStatus: TableStatus.AVAILABLE,
        },
      },
      { upsert: true, new: true },
    );

    console.log('8. Seeding Tables for Green Leaf Bistro...');
    await TableModel.findOneAndUpdate(
      { tableToken: 'tbl_green_01' },
      {
        $set: {
          restaurantId: greenLeaf._id,
          tableNumber: 'Patio Table 1',
          tableToken: 'tbl_green_01',
          capacity: 2,
          operationalStatus: TableStatus.AVAILABLE,
        },
      },
      { upsert: true, new: true },
    );

    console.log('Deterministic development seed completed successfully!');
  } finally {
    await mongoose.disconnect();
  }
}

runSeed().catch((err) => {
  console.error('Seed execution failed:', err);
  process.exit(1);
});
