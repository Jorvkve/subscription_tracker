import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma CLI operations need a direct or session-mode connection. Keep the
    // local fallback so `prisma generate` can run without database credentials.
    url:
      process.env.DIRECT_URL ??
      "postgresql://subscription:subscription@localhost:5432/subscription_tracker",
  },
});
