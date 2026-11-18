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
import { VerifixModule } from './verifix/verifix.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { SalesModule } from './sales/sales.module.js';
import { MoyskladSyncModule } from './moysklad-sync/moysklad-sync.module.js';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule, ScheduleModule.forRoot()],
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
    SeedModule,
    VerifixModule,
    SalesModule,
    EmployeesModule,
    MoyskladSyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
