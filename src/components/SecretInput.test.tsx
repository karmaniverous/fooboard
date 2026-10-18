/**
 * Tests for `SecretInput`: hidden by default, and the eye button shows
 * and hides what was entered.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SecretInput } from './SecretInput';

describe('SecretInput', () => {
  it('hides the secret until the eye button shows it', () => {
    render(<SecretInput aria-label="Token" defaultValue="ghp_x" />);
    const field = screen.getByLabelText('Token');
    expect(field).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveValue('ghp_x');
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('says what the eye button does in a tooltip', async () => {
    render(<SecretInput aria-label="Token" defaultValue="ghp_x" />);
    fireEvent.focus(screen.getByRole('button', { name: 'Show' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Show');
  });
});
