import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../app/App';

describe('App', () => {
  it('shows lobby screen', () => {
    render(<App />);
    expect(screen.getByText('Poker Tournament')).toBeInTheDocument();
    expect(screen.getByText('Create Tournament')).toBeInTheDocument();
    expect(screen.getByText('Join')).toBeInTheDocument();
  });
});
