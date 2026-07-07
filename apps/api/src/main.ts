import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

function configuredCorsOrigins() {
  const configured = process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || "";
  const origins = configured
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return Array.from(new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://nearloy.up.railway.app",
    "https://nearloy.ru",
    "https://www.nearloy.ru",
    ...origins,
  ]));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = configuredCorsOrigins();
  app.enableCors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/$/, "");
      return callback(null, allowedOrigins.includes(normalizedOrigin));
    },
    credentials: true,
  });
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
      "Authentication (Passport + JWT), user roles (CLIENT / COMPANY / ADMIN), OAuth groundwork. Existing client app UI targets CLIENT users.",
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
  console.log(
    `API listening on http://localhost:${port} — Swagger: http://localhost:${port}/api/docs`,
  );
}

bootstrap();
