import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/schema/vaccine-detail.ts',
    './src/schema/vaccine-component.ts',
    './src/schema/applied-vaccination.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  verbose: true,
  strict: true,
});
