import { renderHook, act } from '@testing-library/react';
import { useSuccessToast } from './useSuccessToast';

describe('useSuccessToast', () => {
  it('initializes with closed state', () => {
    const { result } = renderHook(() => useSuccessToast());

    expect(result.current.state.open).toBe(false);
    expect(result.current.state.title).toBe('');
    expect(result.current.state.message).toBe('');
  });

  it('shows toast with given config', () => {
    const { result } = renderHook(() => useSuccessToast());

    act(() => {
      result.current.show({
        title: 'Success!',
        message: 'Operation completed',
      });
    });

    expect(result.current.state.open).toBe(true);
    expect(result.current.state.title).toBe('Success!');
    expect(result.current.state.message).toBe('Operation completed');
  });

  it('shows toast with action label and path', () => {
    const { result } = renderHook(() => useSuccessToast());

    act(() => {
      result.current.show({
        title: 'Raffle Created!',
        message: 'Your raffle is live',
        actionLabel: 'View Raffle',
        actionPath: '/raffles/123',
      });
    });

    expect(result.current.state.actionLabel).toBe('View Raffle');
    expect(result.current.state.actionPath).toBe('/raffles/123');
  });

  it('closes toast', () => {
    const { result } = renderHook(() => useSuccessToast());

    act(() => {
      result.current.show({
        title: 'Success!',
        message: 'Done',
      });
    });

    expect(result.current.state.open).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.state.open).toBe(false);
  });

  it('resets to initial state', () => {
    const { result } = renderHook(() => useSuccessToast());

    act(() => {
      result.current.show({
        title: 'Success!',
        message: 'Done',
      });
    });

    expect(result.current.state.open).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.open).toBe(false);
    expect(result.current.state.title).toBe('');
    expect(result.current.state.message).toBe('');
  });

  it('allows custom duration', () => {
    const { result } = renderHook(() => useSuccessToast());

    act(() => {
      result.current.show({
        title: 'Success!',
        message: 'Done',
        duration: 3000,
      });
    });

    expect(result.current.state.duration).toBe(3000);
  });

  it('preserves previous state when showing new toast', () => {
    const { result } = renderHook(() => useSuccessToast());

    act(() => {
      result.current.show({
        title: 'First Toast',
        message: 'First message',
      });
    });

    act(() => {
      result.current.show({
        title: 'Second Toast',
        message: 'Second message',
      });
    });

    // New properties should override
    expect(result.current.state.title).toBe('Second Toast');
    expect(result.current.state.message).toBe('Second message');
    // Should still be open
    expect(result.current.state.open).toBe(true);
  });
});
