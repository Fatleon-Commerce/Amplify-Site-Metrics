import { defineFunction, secret } from "@aws-amplify/backend";

export const metricsApi = defineFunction({
  name: "metrics-api",
  entry: "./handler.ts",
  timeoutSeconds: 20,
  memoryMB: 256,
  environment: {
    ADMIN_PASSWORD: secret("ADMIN_PASSWORD"),
  },
});
