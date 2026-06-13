import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuccessToast from './SuccessToast';

describe('SuccessToast', () => {
  const mockOnClose = jest.fn();
  const mockOnAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('does not render when open is false', () => {
      render(
        <SuccessToast
          open={false}
          title="Success!"
          message="Operation completed"
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('Success!')).not.toBeInTheDocument();
    });

    it('renders with title and message when open', () => {
      render(
        <SuccessToast
          open={true}
          title="✅ Welcome!"
          message="Your account is ready"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('✅ Welcome!')).toBeInTheDocument();
      expect(screen.getByText('Your account is ready')).toBeInTheDocument();
    });

    it('renders success icon', () => {
      const { container } = render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          onClose={mockOnClose}
        />
      );

      const icon = container.querySelector('svg[data-testid="CheckCircleRoundedIcon"]');
      expect(icon).toBeInTheDocument();
    });

    it('renders without message if not provided', () => {
      render(
        <SuccessToast
          open={true}
          title="Success!"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Success!')).toBeInTheDocument();
    });
  });

  describe('action button', () => {
    it('renders action button when actionLabel provided', () => {
      render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          actionLabel="View Results"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /View Results/i })).toBeInTheDocument();
    });

    it('does not render action button when actionLabel not provided', () => {
      render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByRole('button', { name: /View Results/i })).not.toBeInTheDocument();
    });

    it('navigates to actionPath when action button clicked', async () => {
      const user = userEvent.setup();
      const assignSpy = jest
        .spyOn(window.location, 'assign')
        .mockImplementation(() => undefined);

      render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          actionLabel="View Results"
          actionPath="/results"
          onClose={mockOnClose}
        />
      );

      const actionButton = screen.getByRole('button', { name: /View Results/i });
      await user.click(actionButton);

      expect(assignSpy).toHaveBeenCalledWith('/results');
      expect(mockOnClose).toHaveBeenCalled();
      assignSpy.mockRestore();
    });

    it('calls onAction callback when provided and action button clicked', async () => {
      const user = userEvent.setup();

      render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          actionLabel="Do Something"
          onAction={mockOnAction}
          onClose={mockOnClose}
        />
      );

      const actionButton = screen.getByRole('button', { name: /Do Something/i });
      await user.click(actionButton);

      expect(mockOnAction).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('close button', () => {
    it('renders close button', () => {
      render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText('Dismiss success message')).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();

      render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByLabelText('Dismiss success message');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('auto-dismiss', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('auto-dismisses after default duration (5000ms)', async () => {
      render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          onClose={mockOnClose}
        />
      );

      expect(mockOnClose).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('auto-dismisses after custom duration', async () => {
      render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          duration={3000}
          onClose={mockOnClose}
        />
      );

      expect(mockOnClose).not.toHaveBeenCalled();

      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('does not auto-dismiss before duration expires', async () => {
      render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          duration={5000}
          onClose={mockOnClose}
        />
      );

      jest.advanceTimersByTime(2500);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('clears timeout when component unmounts', async () => {
      const { unmount } = render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          onClose={mockOnClose}
        />
      );

      unmount();

      jest.advanceTimersByTime(5000);

      // onClose should not be called because timeout was cleared
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has proper alert role and aria-live', () => {
      const { container } = render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          onClose={mockOnClose}
        />
      );

      const alertBox = container.querySelector('[role="alert"]');
      expect(alertBox).toHaveAttribute('aria-live', 'polite');
      expect(alertBox).toHaveAttribute('aria-atomic', 'true');
    });

    it('has properly labeled buttons', () => {
      render(
        <SuccessToast
          open={true}
          title="Success!"
          message="Done"
          actionLabel="Continue"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText('Dismiss success message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument();
    });
  });
});
