import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LiveQueue } from './LiveQueue';
import type { PublicQueue } from '@/lib/api';

// The component only needs a socket shape and a translation function; stub both.
vi.mock('@/lib/socket', () => ({ getSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn() }) }));
vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
}));

const base: PublicQueue = { doctorId: 'd1', status: 'AVAILABLE', minutesPerPatient: 10, nowServing: null, lastServed: null, waiting: [] };

afterEach(cleanup);

describe('LiveQueue', () => {
  it('shows the in-room token and waiting count', () => {
    render(
      <LiveQueue
        initial={{
          ...base,
          nowServing: '7',
          waiting: [
            { token: '8', sortOrder: 8 },
            { token: '9', sortOrder: 9 },
          ],
        }}
      />,
    );
    expect(screen.getByText('#7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows a distinct idle state with the last-served token when nobody is in the room', () => {
    render(<LiveQueue initial={{ ...base, nowServing: null, lastServed: '6' }} />);
    expect(screen.getByText('noneYet')).toBeInTheDocument();
    expect(screen.getByText(/lastServed.*"token":"6"/)).toBeInTheDocument();
    expect(screen.queryByText('#6')).not.toBeInTheDocument();
  });
});
