import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Auto-discovery de schemas: todos los .ts de src/schema/ menos el barrel index.
  // Evita tener que registrar a mano cada tabla nueva en este array (COONG-225 #11).
  schema: './src/schema/!(index).ts',
  out: './drizzle',
  dialect: 'postgresql',
  verbose: true,
  strict: true,
});
