import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewerErrorBoundary } from '../ViewerErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('boom');
  }
  return <div>viewer content</div>;
}

describe('ViewerErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when there is no error', () => {
    render(
      <ViewerErrorBoundary label="MPR">
        <Bomb shouldThrow={false} />
      </ViewerErrorBoundary>
    );

    expect(screen.getByText('viewer content')).toBeInTheDocument();
  });

  it('renders a scoped fallback instead of unmounting the whole tree when a child throws', () => {
    render(
      <div>
        <div>rest of the app</div>
        <ViewerErrorBoundary label="MPR">
          <Bomb shouldThrow={true} />
        </ViewerErrorBoundary>
      </div>
    );

    expect(screen.getByText('rest of the app')).toBeInTheDocument();
    expect(screen.getByText(/MPR/)).toBeInTheDocument();
    expect(screen.queryByText('viewer content')).not.toBeInTheDocument();
  });

  it('remounts the children when the reload action is clicked', () => {
    const { rerender } = render(
      <ViewerErrorBoundary label="MPR">
        <Bomb shouldThrow={true} />
      </ViewerErrorBoundary>
    );

    const reloadButton = screen.getByRole('button');
    rerender(
      <ViewerErrorBoundary label="MPR">
        <Bomb shouldThrow={false} />
      </ViewerErrorBoundary>
    );
    fireEvent.click(reloadButton);

    expect(screen.getByText('viewer content')).toBeInTheDocument();
  });
});
