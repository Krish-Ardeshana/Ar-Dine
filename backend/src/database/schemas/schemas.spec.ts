import mongoose, { Types } from 'mongoose';
import {
  CategorySchema,
  MenuItemSchema,
  OrderSchema,
  RestaurantSchema,
  RestaurantTableSchema,
  UserSchema,
} from './index.js';

describe('Mongoose Schemas Validation & Constraints', () => {
  const RestaurantModel =
    mongoose.models.TestRestaurant ||
    mongoose.model('TestRestaurant', RestaurantSchema);

  const UserModel =
    mongoose.models.TestUser ||
    mongoose.model('TestUser', UserSchema);

  const CategoryModel =
    mongoose.models.TestCategory ||
    mongoose.model('TestCategory', CategorySchema);

  const MenuItemModel =
    mongoose.models.TestMenuItem ||
    mongoose.model('TestMenuItem', MenuItemSchema);

  const TableModel =
    mongoose.models.TestTable ||
    mongoose.model('TestTable', RestaurantTableSchema);

  const OrderModel =
    mongoose.models.TestOrder ||
    mongoose.model('TestOrder', OrderSchema);

  describe('RestaurantSchema', () => {
    it('should validate valid restaurant document', async () => {
      const doc = new RestaurantModel({
        name: 'Spice Craft Kitchen',
        slug: 'spice-craft-kitchen',
        contact: {
          email: 'contact@spicecraft.com',
          phone: '+91 9876543210',
        },
        address: {
          street: '12 Heritage Way',
          city: 'Ahmedabad',
          state: 'Gujarat',
          postalCode: '380015',
          country: 'India',
        },
      });

      await expect(doc.validate()).resolves.toBeUndefined();
    });

    it('should fail when required slug or contact is missing', async () => {
      const doc = new RestaurantModel({
        name: 'Incomplete Restaurant',
      });

      await expect(doc.validate()).rejects.toThrow();
    });
  });

  describe('UserSchema', () => {
    it('should validate user with valid normalized email', async () => {
      const doc = new UserModel({
        name: 'Arjun Mehta',
        email: 'arjun@example.com',
        globalRoles: ['RESTAURANT_ADMIN'],
      });

      await expect(doc.validate()).resolves.toBeUndefined();
    });

    it('should fail when invalid role is provided', async () => {
      const doc = new UserModel({
        name: 'Invalid User',
        email: 'invalid@example.com',
        globalRoles: ['UNRECOGNIZED_ROLE'],
      });

      await expect(doc.validate()).rejects.toThrow();
    });
  });

  describe('CategorySchema', () => {
    it('should validate category with required restaurantId and name', async () => {
      const doc = new CategoryModel({
        restaurantId: new Types.ObjectId(),
        name: 'Appetizers',
        displayOrder: 1,
      });

      await expect(doc.validate()).resolves.toBeUndefined();
    });

    it('should fail when restaurantId is missing', async () => {
      const doc = new CategoryModel({
        name: 'Orphan Category',
      });

      await expect(doc.validate()).rejects.toThrow();
    });
  });

  describe('MenuItemSchema', () => {
    it('should reject negative price', async () => {
      const doc = new MenuItemModel({
        restaurantId: new Types.ObjectId(),
        categoryId: new Types.ObjectId(),
        slug: 'paneer-tikka',
        name: 'Paneer Tikka',
        price: -50,
      });

      await expect(doc.validate()).rejects.toThrow('Price must be non-negative');
    });

    it('should accept non-negative price with 3D model metadata', async () => {
      const doc = new MenuItemModel({
        restaurantId: new Types.ObjectId(),
        categoryId: new Types.ObjectId(),
        slug: 'paneer-tikka',
        name: 'Paneer Tikka',
        price: 320,
        model3d: {
          glbUrl: 'https://cdn.example.com/models/paneer_tikka.glb',
          format: 'glb',
          polyCount: 45000,
        },
      });

      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.model3d?.format).toBe('glb');
    });
  });

  describe('RestaurantTableSchema', () => {
    it('should reject table capacity less than 1', async () => {
      const doc = new TableModel({
        restaurantId: new Types.ObjectId(),
        tableNumber: 'T-01',
        tableToken: 'tbl_safe_token_01',
        capacity: 0,
      });

      await expect(doc.validate()).rejects.toThrow('Table capacity must be at least 1');
    });

    it('should accept valid table with token', async () => {
      const doc = new TableModel({
        restaurantId: new Types.ObjectId(),
        tableNumber: 'T-01',
        tableToken: 'tbl_safe_token_01',
        capacity: 4,
      });

      await expect(doc.validate()).resolves.toBeUndefined();
    });
  });

  describe('OrderSchema Snapshot Preservation', () => {
    it('should enforce immutable order snapshot with positive prices and quantities', async () => {
      const orderDoc = new OrderModel({
        restaurantId: new Types.ObjectId(),
        tableId: new Types.ObjectId(),
        orderNumber: 'ORD-20261012-0001',
        items: [
          {
            menuItemId: new Types.ObjectId(),
            name: 'Paneer Tikka (Snapshot)',
            unitPrice: 320,
            quantity: 2,
            subtotal: 640,
            specialInstructions: 'Extra mint chutney',
          },
        ],
        subtotal: 640,
        taxAmount: 32,
        discountAmount: 0,
        grandTotal: 672,
        status: 'PLACED',
        paymentStatus: 'PENDING',
      });

      await expect(orderDoc.validate()).resolves.toBeUndefined();
      expect(orderDoc.items[0].name).toBe('Paneer Tikka (Snapshot)');
      expect(orderDoc.items[0].unitPrice).toBe(320);
      expect(orderDoc.grandTotal).toBe(672);
    });

    it('should reject order with empty items array', async () => {
      const orderDoc = new OrderModel({
        restaurantId: new Types.ObjectId(),
        tableId: new Types.ObjectId(),
        orderNumber: 'ORD-20261012-0002',
        items: [],
        subtotal: 0,
        grandTotal: 0,
      });

      await expect(orderDoc.validate()).rejects.toThrow();
    });

    it('should reject order item with quantity less than 1', async () => {
      const orderDoc = new OrderModel({
        restaurantId: new Types.ObjectId(),
        tableId: new Types.ObjectId(),
        orderNumber: 'ORD-20261012-0003',
        items: [
          {
            menuItemId: new Types.ObjectId(),
            name: 'Item',
            unitPrice: 100,
            quantity: 0,
            subtotal: 0,
          },
        ],
        subtotal: 0,
        grandTotal: 0,
      });

      await expect(orderDoc.validate()).rejects.toThrow();
    });
  });
});
