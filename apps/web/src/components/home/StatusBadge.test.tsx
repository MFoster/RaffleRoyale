import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '@/theme';
import StatusBadge, { getStatusBadgeType } from './StatusBadge';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('StatusBadge', () => {
  describe('rendering', () => {
    it('renders ending-soon badge', () => {
      render(
        <TestWrapper>
          <StatusBadge type="ending-soon" />
        </TestWrapper>
      );

      expect(screen.getByText('⏰ Ending Soon')).toBeInTheDocument();
    });

    it('renders new badge', () => {
      render(
        <TestWrapper>
          <StatusBadge type="new" />
        </TestWrapper>
      );

      expect(screen.getByText('✨ New')).toBeInTheDocument();
    });

    it('renders hot badge', () => {
      render(
        <TestWrapper>
          <StatusBadge type="hot" />
        </TestWrapper>
      );

      expect(screen.getByText('🔥 Hot')).toBeInTheDocument();
    });

    it('renders with small size', () => {
      const { container } = render(
        <TestWrapper>
          <StatusBadge type="ending-soon" size="small" />
        </TestWrapper>
      );

      const chip = container.querySelector('.MuiChip-sizeSmall');
      expect(chip).toBeInTheDocument();
    });

    it('renders with outlined variant', () => {
      const { container } = render(
        <TestWrapper>
          <StatusBadge type="ending-soon" variant="outlined" />
        </TestWrapper>
      );

      const chip = container.querySelector('.MuiChip-outlined');
      expect(chip).toBeInTheDocument();
    });
  });

  describe('getStatusBadgeType helper', () => {
    const now = new Date();

    it('returns ending-soon for raffles ending in less than 24 hours', () => {
      const endTime = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours
      const result = getStatusBadgeType(endTime, now, 50, 100);

      expect(result).toBe('ending-soon');
    });

    it('returns null for raffles ending in more than 24 hours', () => {
      const endTime = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
      const result = getStatusBadgeType(endTime, now, 50, 100);

      expect(result).not.toBe('ending-soon');
    });

    it('returns new for raffles created less than 3 days ago', () => {
      const createdAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const result = getStatusBadgeType(endTime, createdAt, 50, 100);

      expect(result).toBe('new');
    });

    it('returns null for raffles created more than 3 days ago', () => {
      const createdAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const result = getStatusBadgeType(endTime, createdAt, 50, 100);

      expect(result).not.toBe('new');
    });

    it('returns hot for raffles with 75%+ tickets sold', () => {
      const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const createdAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const result = getStatusBadgeType(endTime, createdAt, 80, 100);

      expect(result).toBe('hot');
    });

    it('returns null when conditions do not match any status', () => {
      const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const createdAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const result = getStatusBadgeType(endTime, createdAt, 50, 100);

      expect(result).toBeNull();
    });

    it('prioritizes ending-soon over new', () => {
      // New but ending soon
      const createdAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const endTime = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours
      const result = getStatusBadgeType(endTime, createdAt, 50, 100);

      expect(result).toBe('ending-soon');
    });

    it('prioritizes new over hot', () => {
      // New but high sales
      const createdAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const result = getStatusBadgeType(endTime, createdAt, 80, 100);

      expect(result).toBe('new');
    });
  });
});
