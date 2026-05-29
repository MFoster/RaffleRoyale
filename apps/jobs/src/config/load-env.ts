import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const ENV_CANDIDATES = ['.env', '../api/.env'];

export function loadEnv(): void {
  for (const envFile of ENV_CANDIDATES) {
    const resolved = path.resolve(process.cwd(), envFile);

    if (!fs.existsSync(resolved)) {
      continue;
    }

    dotenv.config({ path: resolved, override: false });
  }
}
