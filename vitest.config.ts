import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true
  },
  resolve: {
    alias: {
      "@": "/Users/wgrana/Documents/AI Resume Screener/src"
    }
  }
});
