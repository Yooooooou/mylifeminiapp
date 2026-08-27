/**
 * The offer must never appear where it cannot be honoured. Support is decided
 * by the Telegram client, so each answer it can give gets a case.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function mountWith(webApp) {
  vi.resetModules();
  if (webApp) window.Telegram = { WebApp: webApp };
  else delete window.Telegram;
  window.localStorage.clear();
  return import('../components/HomeScreenPrompt');
}

const base = {
  initData: 'auth_date=1&hash=abc',
  ready() {},
  expand() {},
  onEvent() {},
  offEvent() {},
  themeParams: {},
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  delete window.Telegram;
});

describe('HomeScreenPrompt', () => {
  it('points at the client menu where it cannot install the icon itself', async () => {
    // iOS answers this way, but its ⋯ menu still carries the option, so the
    // row explains where to find it rather than disappearing.
    const { HomeScreenPrompt } = await mountWith({
      ...base,
      addToHomeScreen() {},
      checkHomeScreenStatus: (cb) => cb('unsupported'),
    });

    render(<HomeScreenPrompt />);
    expect(await screen.findByText(/Меню ⋯/)).toBeInTheDocument();
    expect(screen.queryByText('Добавить')).not.toBeInTheDocument();
  });

  it('stays hidden once the icon is already there', async () => {
    const { HomeScreenPrompt } = await mountWith({
      ...base,
      addToHomeScreen() {},
      checkHomeScreenStatus: (cb) => cb('added'),
    });

    render(<HomeScreenPrompt />);
    await waitFor(() => expect(screen.queryByText('Добавить')).not.toBeInTheDocument());
  });

  it('offers the icon when the client says it is missing', async () => {
    const addToHomeScreen = vi.fn();
    const { HomeScreenPrompt } = await mountWith({
      ...base,
      addToHomeScreen,
      checkHomeScreenStatus: (cb) => cb('missing'),
    });

    render(<HomeScreenPrompt />);
    await userEvent.click(await screen.findByText('Добавить'));
    expect(addToHomeScreen).toHaveBeenCalled();
  });

  it('does not ask again after it is dismissed', async () => {
    const { HomeScreenPrompt } = await mountWith({
      ...base,
      addToHomeScreen() {},
      checkHomeScreenStatus: (cb) => cb('missing'),
    });

    const first = render(<HomeScreenPrompt />);
    await userEvent.click(await screen.findByLabelText('Скрыть предложение'));

    // It has to go away on the spot, not only on the next mount — asserting
    // just the reopen let a throwing handler pass, since the dismissal was
    // already stored by then.
    await waitFor(() => expect(screen.queryByText('Добавить')).not.toBeInTheDocument());
    first.unmount();

    render(<HomeScreenPrompt />);
    await waitFor(() => expect(screen.queryByText('Добавить')).not.toBeInTheDocument());
  });

  it('never offers a button a plain browser cannot honour', async () => {
    const { HomeScreenPrompt } = await mountWith(null);
    render(<HomeScreenPrompt />);
    await waitFor(() => expect(screen.queryByText('Добавить')).not.toBeInTheDocument());
  });
});
