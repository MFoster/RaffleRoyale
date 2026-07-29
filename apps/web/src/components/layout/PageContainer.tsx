import Container from '@mui/material/Container';
import type { ContainerProps } from '@mui/material/Container';

export type PageContainerProps = ContainerProps;

/**
 * Standardized page width + horizontal gutters.
 *
 * Use instead of hand-tuning `maxWidth` / `px` on a raw `Container`, so every
 * page shares the same reading width and responsive gutters.
 */
export default function PageContainer({
  children,
  maxWidth = 'xl',
  sx,
  ...rest
}: PageContainerProps) {
  return (
    <Container
      maxWidth={maxWidth}
      sx={[
        { px: { xs: 2.5, sm: 3, md: 4 } },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    >
      {children}
    </Container>
  );
}
