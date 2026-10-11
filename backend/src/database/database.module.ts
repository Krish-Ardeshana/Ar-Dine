import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseService } from './database.service.js';
import { TenantValidationService } from './multi-tenant/tenant-validation.service.js';
import {
  Category,
  CategorySchema,
  DiningSession,
  DiningSessionSchema,
  MenuItem,
  MenuItemSchema,
  Order,
  OrderSchema,
  Restaurant,
  RestaurantSchema,
  RestaurantTable,
  RestaurantTableSchema,
  User,
  UserSchema,
} from './schemas/index.js';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        const defaultUri = 'mongodb://127.0.0.1:27017/ar_dine_unconfigured';

        return {
          uri: uri && uri.trim().length > 0 ? uri : defaultUri,
          lazyConnection: true,
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 5000,
          autoIndex: configService.get<string>('NODE_ENV') !== 'production',
        };
      },
    }),
    MongooseModule.forFeature([
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: User.name, schema: UserSchema },
      { name: Category.name, schema: CategorySchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: RestaurantTable.name, schema: RestaurantTableSchema },
      { name: DiningSession.name, schema: DiningSessionSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  providers: [DatabaseService, TenantValidationService],
  exports: [DatabaseService, TenantValidationService, MongooseModule],
})
export class DatabaseModule {}
