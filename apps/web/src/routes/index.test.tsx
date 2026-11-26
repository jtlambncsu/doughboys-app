import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { seedEpisodes } from '@/test/fixtures';
import { renderApp } from '@/test/renderApp';

describe('leaderboard', () => {
  it('ranks chains by average forks', async () => {
    seedEpisodes();
    renderApp('/');

    const list = await screen.findByRole('list', { name: 'Chains' });
    const rows = within(list).getAllByRole('link');
    expect(rows.map((row) => row.textContent)).toEqual(['1Taco Bell4.5 forks', '2IHOP3.83 forks']);
  });

  it('filters by name, keeps the real rank, and puts the search in the URL', async () => {
    seedEpisodes();
    const { router } = renderApp('/');

    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search chains' }), 'ihop');

    const rows = within(screen.getByRole('list', { name: 'Chains' })).getAllByRole('link');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('2IHOP');
    expect(router.state.location.search).toEqual({ q: 'ihop' });
  });

  it('opens the latest episode for a chain', async () => {
    seedEpisodes();
    renderApp('/');

    await userEvent.click(await screen.findByRole('link', { name: /IHOP/ }));

    expect(
      await screen.findByRole('heading', { name: 'IHOP with Alison Agosti' }),
    ).toBeInTheDocument();
  });
});

describe('branding', () => {
  it('says it is an unofficial fan app next to the name, and credits the wiki', async () => {
    seedEpisodes();
    renderApp('/');

    expect(
      await screen.findByRole('link', { name: /Doughboys App\s*Unofficial fan app/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not affiliated with Doughboys/)).toBeInTheDocument();
  });
});
