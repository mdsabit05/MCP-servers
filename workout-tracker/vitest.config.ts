import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: ":memory:",
      BETTER_AUTH_SECRET: "test-secret-32-chars-padding-here",
      BASE_URL: "http://localhost:47832",
    },
  },
});
