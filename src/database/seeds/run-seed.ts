import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';
import { SuperAdminSeed } from './super-admin.seed.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const superAdminSeed = app.get(SuperAdminSeed);
    const result = await superAdminSeed.run();
    console.log(result.message);
    console.log(`Login: ${result.login}`);
  } finally {
    await app.close();
  }
}

await bootstrap();
