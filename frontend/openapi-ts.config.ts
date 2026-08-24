import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-axios',
  input: '../openapi.yaml',
  output: {
    path: './src/api',
  },
  types: {
    enums: 'javascript',
  },
  plugins: [
    '@tanstack/react-query',
  ]
});
