import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';
import type { JobCommand } from './types';

interface UnsplashPhoto {
  id: string;
  urls: {
    raw?: string;
    regular: string;
  };
  alt_description: string;
}

interface SeedFixture {
  raffles: Array<{
    title: string;
    imageUrls?: string[];
    imageSearchTerms?: string[];
  }>;
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath);
    return true;
  } catch {
    return false;
  }
}

function buildDownloadUrl(photo: UnsplashPhoto): string {
  const url = new URL(photo.urls.raw ?? photo.urls.regular);
  url.searchParams.set('fm', 'jpg');
  url.searchParams.set('fit', 'crop');
  url.searchParams.set('w', '1600');
  url.searchParams.set('h', '900');
  url.searchParams.set('q', '80');
  return url.toString();
}

function buildFallbackSearchTerms(title: string): string[] {
  const compact = title
    .split(' ')
    .filter((word) => !['Size', 'GB', 'RAM', 'Edition', 'PSA', 'BGS'].includes(word))
    .slice(0, 3)
    .join(' ');

  return [compact];
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

  const arrayBuffer = await response.arrayBuffer();
  await writeFile(filepath, Buffer.from(arrayBuffer));
  console.log(`✓ Downloaded: ${path.basename(filepath)}`);
}

async function fetchProductImages(): Promise<void> {
  const outputDir = path.resolve(process.cwd(), 'fixtures/raffle-items');
  const fixtureFile = path.resolve(process.cwd(), 'fixtures/seed.yaml');

  await mkdir(outputDir, { recursive: true });

  // Load raffle titles from seed.yaml
  const fixtureContent = await readFile(fixtureFile, 'utf-8');
  const fixture = loadYaml(fixtureContent) as SeedFixture;

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.error('Error: UNSPLASH_ACCESS_KEY environment variable is not set');
    console.error('Sign up at https://unsplash.com/developers to get a free access key');
    process.exit(1);
  }

  console.log(`\nFetching product images from Unsplash based on seed.yaml...\n`);

  let skippedCount = 0;
  let fetchedCount = 0;
  let errorCount = 0;

  for (const [i, raffle] of fixture.raffles.entries()) {
    const imageUrls = raffle.imageUrls || [];

    if (imageUrls.length === 0) {
      console.log(`[${i + 1}/${fixture.raffles.length}] ⊘ Skipped (no images): ${raffle.title}`);
      continue;
    }

    try {
      const filenames = imageUrls
        .map((url) => url.split('/').pop())
        .filter(isNonEmptyString);

      const fileExistResults = await Promise.all(
        filenames.map((filename) => fileExists(path.join(outputDir, filename))),
      );

      if (fileExistResults.every((exists) => exists)) {
        console.log(`[${i + 1}/${fixture.raffles.length}] ⊘ Skipped (all cached): ${raffle.title}`);
        skippedCount++;
        continue;
      }

      const searchTerms =
        raffle.imageSearchTerms && raffle.imageSearchTerms.length > 0
          ? raffle.imageSearchTerms.filter((term) => term.trim().length > 0)
          : buildFallbackSearchTerms(raffle.title);
      const photos: UnsplashPhoto[] = [];
      const seenPhotoIds = new Set<string>();
      let requestCount = 0;

      for (const searchTerm of searchTerms) {
        if (photos.length >= filenames.length) {
          break;
        }

        console.log(`[${i + 1}/${fixture.raffles.length}] Searching for: "${searchTerm}"`);
        const searchUrl = new URL('https://api.unsplash.com/search/photos');
        searchUrl.searchParams.set('query', searchTerm);
        searchUrl.searchParams.set('per_page', String(Math.max(filenames.length * 3, 6)));
        searchUrl.searchParams.set('order_by', 'relevant');
        searchUrl.searchParams.set('client_id', accessKey);

        const searchResponse = await fetch(searchUrl.toString());
        requestCount += 1;

        if (!searchResponse.ok) {
          console.warn(`⚠ API error for "${searchTerm}": ${searchResponse.statusText}`);
        } else {
          const searchData = (await searchResponse.json()) as { results: UnsplashPhoto[] };

          if (!Array.isArray(searchData.results) || searchData.results.length === 0) {
            console.warn(`⚠ No results for "${searchTerm}"`);
          } else {
            for (const photo of searchData.results) {
              if (!seenPhotoIds.has(photo.id)) {
                seenPhotoIds.add(photo.id);
                photos.push(photo);
              }

              if (photos.length >= filenames.length) {
                break;
              }
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      if (photos.length === 0) {
        errorCount++;
        console.warn(`⚠ No usable image results found for "${raffle.title}"`);
      } else {
        for (const [j, filename] of filenames.entries()) {
          const photo = photos[j];
          const filepath = path.join(outputDir, filename);

          if (!(await fileExists(filepath)) && photo) {
            await downloadImage(buildDownloadUrl(photo), filepath);
          } else if (await fileExists(filepath)) {
            console.log(`✓ Found (cached): ${filename}`);
          }
        }

        if (requestCount > 0) {
          fetchedCount++;
        }
      }
    } catch (error) {
      console.error(`✗ Error fetching images for "${raffle.title}":`, error);
      errorCount++;
    }
  }

  console.log(
    `\n✓ Complete: Fetched ${fetchedCount}, Skipped ${skippedCount}, Errors ${errorCount}\n`,
  );
}

export const fetchImagesCommand: JobCommand = {
  name: 'fetch:images',
  description: 'Fetch product images from Unsplash and store locally',
  run: async () => {
    await fetchProductImages();
  },
};
