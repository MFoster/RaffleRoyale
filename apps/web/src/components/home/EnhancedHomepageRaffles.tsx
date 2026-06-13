'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeaturedCarousel from './FeaturedCarousel';
import RaffleGallery from './RaffleGallery';
import type { SortOption } from './RaffleSortingControl';
import type { RaffleData } from './EnhancedRaffleCard';

export interface EnhancedHomepageRafflesProps {
  raffles: RaffleData[];
  showFeatured?: boolean;
  showGallery?: boolean;
  title?: string;
  subtitle?: string;
}

/**
 * EnhancedHomepageRaffles - Wrapper component for featuring and gallery raffles on homepage
 *
 * Combines FeaturedCarousel and RaffleGallery with navigation handling
 */
export default function EnhancedHomepageRaffles({
  raffles,
  showFeatured = true,
  showGallery = true,
  title,
  subtitle,
}: EnhancedHomepageRafflesProps) {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortOption>('ending-soon');

  const handleRaffleClick = useCallback(
    (raffleId: string) => {
      router.push(`/raffles/${raffleId}`);
    },
    [router]
  );

  return (
    <>
      {showFeatured && raffles.length > 0 && (
        <FeaturedCarousel
          raffles={raffles}
          onRaffleClick={handleRaffleClick}
          autoAdvanceIntervalMs={8000}
        />
      )}

      {showGallery && raffles.length > 0 && (
        <RaffleGallery
          raffles={raffles}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onRaffleClick={handleRaffleClick}
          title={title}
          subtitle={subtitle}
          showSorting
        />
      )}
    </>
  );
}
