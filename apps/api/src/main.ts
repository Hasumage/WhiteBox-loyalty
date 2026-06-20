import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
  app.enableCors({ origin, credentials: true });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("NearLoy API")
    .setDescription(
      "Authentication (Passport + JWT), user roles (CLIENT / COMPANY / ADMIN), OAuth groundwork. Existing TWA UI targets CLIENT users.",
    )
    .setVersion("1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT", in: "header" },
      "access-token",
    )
    .addTag("auth", "Registration, login, refresh, profile")
    .addTag("health", "Liveness")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(
    `API listening on http://localhost:${port} — Swagger: http://localhost:${port}/api/docs`,
  );
}

bootstrap();
