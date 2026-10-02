import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true
});

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

  console.log(`VoxFlow API running on http://localhost:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}