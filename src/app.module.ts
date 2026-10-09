import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module.js';
import { CompaniesModule } from './companies/companies.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { BooksModule } from './books/books.module.js';
import { ShipmentsModule } from './shipments/shipments.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { RolesModule } from './roles/roles.module.js';
import { SeedModule } from './database/seeds/seed.module.js';
import { getMongoConnectionUri } from './config/mongodb-uri.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: getMongoConnectionUri(
          configService.getOrThrow<string>('MONGODB_URI'),
        ),
      }),
    }),
    UsersModule,
    AuthModule,
    CompaniesModule,
    CustomersModule,
    BooksModule,
    ShipmentsModule,
    PaymentsModule,
    RolesModule,
    SeedModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
