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
  it('stays hidden where the client cannot install an icon', async () => {
    // iOS answers this way; a browser has no methods at all.
    const { HomeScreenPrompt } = await mountWith({
      ...base,
      addToHomeScreen() {},
      checkHomeScreenStatus: (cb) => cb('unsupported'),
    });

    render(<HomeScreenPrompt />);
    await waitFor(() => expect(screen.queryByText('Добавить')).not.toBeInTheDocument());
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
    first.unmount();

    render(<HomeScreenPrompt />);
    await waitFor(() => expect(screen.queryByText('Добавить')).not.toBeInTheDocument());
  });

  it('stays hidden in a plain browser', async () => {
    const { HomeScreenPrompt } = await mountWith(null);
    render(<HomeScreenPrompt />);
    await waitFor(() => expect(screen.queryByText('Добавить')).not.toBeInTheDocument());
  });
});
