import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import transcriptionRoute from "./routes/transcription";
import languageRoute from "./routes/language";
import understandingRoute from "./routes/understanding";
import contextRoute from "./routes/context";
import transformationRoute from "./routes/transformation";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true
});

await app.register(multipart);

await app.register(transcriptionRoute);
await app.register(languageRoute);
await app.register(understandingRoute);
await app.register(contextRoute);
await app.register(transformationRoute);

app.get("/health", async () => {
  return {
    status: "ok",
    service: "voxflow-api"
  };
});

const port = Number(process.env.PORT ?? 3001);

try {
  await app.listen({
    port,
    host: "0.0.0.0"
  });

  console.log(
    `VoxFlow API running on http://localhost:${port}`
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}