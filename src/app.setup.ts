import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Shared by main.ts and the e2e tests, so tests run the app exactly as it
// runs in production.
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.enableShutdownHooks();
  setupSwagger(app);
}

// Serves the UI at /docs and the raw OpenAPI spec at /docs-json. Neither path
// can clash with a short link, since codes are exactly 7 characters.
function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('URL Shortener API')
    .setDescription('Shorten URLs and redirect short links to them.')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
}
