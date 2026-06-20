import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { load as loadYaml, dump as dumpYaml } from 'js-yaml';
import type { JobCommand } from './types';

interface SeedFixture {
  raffles: Array<{
    title: string;
    imageUrls?: string[];
  }>;
}

function sortImageFiles(a: string, b: string): number {
  const rank = (fileName: string): number => {
    if (fileName.includes('-primary.')) {
      return 0;
    }

    if (fileName.includes('-alt.')) {
      return 1;
    }

    return 2;
  };

  return rank(a) - rank(b) || a.localeCompare(b);
}

async function loadUploadFilesByItemPrefix(): Promise<Map<string, string[]>> {
  const uploadsRoot =
    process.env.UPLOADS_DIRECTORY ?? path.resolve(process.cwd(), 'uploads');
  const raffleUploadsDirectory = path.join(uploadsRoot, 'raffles');
  const files = (await readdir(raffleUploadsDirectory)).filter((fileName) =>
    fileName.toLowerCase().endsWith('.jpg'),
  );
  const filesByPrefix = new Map<string, string[]>();

  for (const fileName of files) {
    const match = /^(item-\d{3})-/.exec(fileName);

    const itemPrefix = match?.[1];

    if (!itemPrefix) {
      continue;
    }
    const existing = filesByPrefix.get(itemPrefix) ?? [];
    existing.push(fileName);
    filesByPrefix.set(itemPrefix, existing);
  }

  for (const entry of filesByPrefix.values()) {
    entry.sort(sortImageFiles);
  }

  return filesByPrefix;
}

async function fixSeedUrls(): Promise<void> {
  const fixtureFile = path.resolve(process.cwd(), 'fixtures/seed.yaml');
  const uploadFilesByItemPrefix = await loadUploadFilesByItemPrefix();

  const fixtureContent = await readFile(fixtureFile, 'utf-8');
  const fixture = loadYaml(fixtureContent) as SeedFixture;

  console.log('\nUpdating seed.yaml imageUrls to match uploaded files...\n');

  let updatedCount = 0;
  let missingCount = 0;

  for (const [i, raffle] of fixture.raffles.entries()) {
    const itemPrefix = `item-${String(i + 1).padStart(3, '0')}`;
    const matchingFiles = uploadFilesByItemPrefix.get(itemPrefix);

    if (!matchingFiles || matchingFiles.length === 0) {
      console.log(
        `[${i + 1}/${fixture.raffles.length}] ⚠ No uploaded files found for ${itemPrefix}: ${raffle.title}`,
      );
      missingCount++;
      continue;
    }

    const newUrls = matchingFiles.map(
      (fileName) => `/api/uploads/raffles/${fileName}`,
    );

    if (JSON.stringify(raffle.imageUrls) !== JSON.stringify(newUrls)) {
      raffle.imageUrls = newUrls;
      console.log(
        `[${i + 1}/${fixture.raffles.length}] ✓ Updated ${itemPrefix}: ${raffle.title}`,
      );
      updatedCount++;
    } else {
      console.log(
        `[${i + 1}/${fixture.raffles.length}] ⊘ Already correct ${itemPrefix}: ${raffle.title}`,
      );
    }
  }

  const yaml = dumpYaml(fixture, { lineWidth: -1, forceQuotes: true });
  await writeFile(fixtureFile, yaml);

  console.log(
    `\n✓ Updated ${updatedCount} raffles in seed.yaml (${missingCount} missing upload groups)\n`,
  );
}

export const fixSeedUrlsCommand: JobCommand = {
  name: 'fix:seed-urls',
  description: 'Update seed.yaml imageUrls to match uploaded files by item prefix',
  run: async () => {
    await fixSeedUrls();
  },
};
