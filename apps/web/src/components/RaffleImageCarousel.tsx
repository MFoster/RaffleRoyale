'use client';

import { useCallback, useEffect, useState } from 'react';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import useEmblaCarousel from 'embla-carousel-react';

type RaffleImageCarouselProps = {
  imageUrls: string[];
  title: string;
};

export default function RaffleImageCarousel({
  imageUrls,
  title,
}: RaffleImageCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(imageUrls.length > 1);
  const hasMultipleImages = imageUrls.length > 1;

  const onSelect = useCallback(() => {
    if (!emblaApi) {
      return;
    }

    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  const handlePrevious = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const handleNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const handleThumbnailClick = useCallback(
    (index: number) => {
      emblaApi?.scrollTo(index);
    },
    [emblaApi],
  );

  return (
    <Stack spacing={1.5}>
      <Box sx={{ position: 'relative' }}>
        <Box
          ref={emblaRef}
          sx={{
            overflow: 'hidden',
            borderRadius: 3,
            border: '1px solid',
            borderColor: alpha('#5B3DF5', 0.2),
          }}
        >
          <Box sx={{ display: 'flex' }}>
            {imageUrls.map((imageUrl, index) => (
              <Box key={`${imageUrl}-${String(index)}`} sx={{ flex: '0 0 100%', minWidth: 0 }}>
                <Box
                  component="img"
                  src={imageUrl}
                  alt={`${title} image ${String(index + 1)}`}
                  sx={{
                    width: '100%',
                    minHeight: 320,
                    maxHeight: { xs: 420, md: 500 },
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </Box>
            ))}
          </Box>
        </Box>

        {hasMultipleImages ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 1,
              bgcolor: alpha('#150E35', 0.4),
              borderRadius: 999,
              p: 0.5,
            }}
          >
            <IconButton
              size="small"
              onClick={handlePrevious}
              disabled={!canScrollPrev}
              aria-label="Previous raffle image"
              sx={{ color: '#fff' }}
            >
              <ChevronLeftRounded fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleNext}
              disabled={!canScrollNext}
              aria-label="Next raffle image"
              sx={{ color: '#fff' }}
            >
              <ChevronRightRounded fontSize="small" />
            </IconButton>
          </Stack>
        ) : null}
      </Box>

      {hasMultipleImages ? (
        <Box>
          <Box
            sx={{
              display: 'grid',
              gridAutoFlow: 'column',
              gridAutoColumns: { xs: 116, sm: 132 },
              gap: 1,
              overflowX: 'auto',
              pb: 0.5,
              '&::-webkit-scrollbar': {
                height: 8,
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: alpha('#5B3DF5', 0.26),
                borderRadius: 999,
              },
            }}
          >
            {imageUrls.map((imageUrl, index) => (
              <ButtonBase
                key={`${imageUrl}-thumb-${String(index)}`}
                onClick={() => {
                  handleThumbnailClick(index);
                }}
                aria-label={`Go to image ${String(index + 1)}`}
                sx={{
                  width: '100%',
                  borderRadius: 1.75,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor:
                    selectedIndex === index
                      ? alpha('#5B3DF5', 0.45)
                      : alpha('#5B3DF5', 0.18),
                }}
              >
                <Box
                  component="img"
                  src={imageUrl}
                  alt={`${title} gallery image ${String(index + 1)}`}
                  sx={{
                    width: '100%',
                    height: 86,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </ButtonBase>
            ))}
          </Box>
        </Box>
      ) : null}
    </Stack>
  );
}
