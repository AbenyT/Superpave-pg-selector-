import 'dotenv/config'; // loads backend/.env locally; on Render the variables come from the dashboard
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1); // Render runs behind one proxy: use the real client address for rate limits
  configureApp(app);
  const port = Number(process.env.PORT ?? 4100); // Render sets PORT; locally 4100 (the AASHTO app uses 4000)
  await app.listen(port, '0.0.0.0');
  console.log(`Superpave PG API listening on port ${port}`);
}
void bootstrap();
