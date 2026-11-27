import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { db } from '@/test/server';
import { seedEpisodes } from '@/test/fixtures';
import { renderApp } from '@/test/renderApp';

/** Five chains: four restaurants (one visited three times) and a grocery store. */
function seedBoard() {
  const add = (restaurant: string, forks: number, n = 1) => {
    for (let i = 0; i < n; i++) {
      db.add({
        slug: `${restaurant} ${i}`,
        restaurant,
        averageForks: forks,
        releaseDate: `202${i}-01-01`,
      });
    }
  };
  add('Zankou Chicken', 5.67);
  add('Taco Bell', 4, 3);
  add('Albertsons', 4.5);
  add('IHOP', 3.83);
  add('Arby’s', 2);
  db.chains.set('Albertsons', {
    name: 'Albertsons',
    category: 'grocery',
    domain: 'albertsons.com',
  });
  db.chains.set('Taco Bell', { name: 'Taco Bell', category: 'restaurant', domain: 'tacobell.com' });
}

const names = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => within(item).getByRole('link').querySelector('.font-medium')?.textContent);

describe('leaderboard', () => {
  it('puts the top three restaurants on a podium, leaving out non-restaurants', async () => {
    seedBoard();
    renderApp('/');

    const podium = await screen.findByRole('list', { name: 'Top three' });
    expect(names(podium)).toEqual(['Zankou Chicken', 'Taco Bell', 'IHOP']);
    expect(within(podium).getByLabelText('Rank 1')).toHaveTextContent('🥇');
    expect(names(screen.getByRole('list', { name: 'Chains' }))).toEqual(['Arby’s']);
    expect(screen.queryByText('Albertsons')).not.toBeInTheDocument();
  });

  it('shows how many times each chain was visited, and can sort by it', async () => {
    seedBoard();
    const { router } = renderApp('/');

    const podium = await screen.findByRole('list', { name: 'Top three' });
    expect(within(podium).getByText('3 visits')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Most visited' }));
    expect(names(screen.getByRole('list', { name: 'Top three' }))[0]).toBe('Taco Bell');
    expect(router.state.location.search).toEqual({ sort: 'visits' });
  });

  it('can include everything', async () => {
    seedBoard();
    const { router } = renderApp('/');

    await userEvent.click(await screen.findByRole('radio', { name: 'Everything' }));

    expect(names(screen.getByRole('list', { name: 'Top three' }))).toEqual([
      'Zankou Chicken',
      'Albertsons',
      'Taco Bell',
    ]);
    expect(router.state.location.search).toEqual({ show: 'all' });
  });

  it('searches by name, keeping each chain’s real rank, and puts the search in the URL', async () => {
    seedBoard();
    const { router } = renderApp('/');

    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search chains' }), 'ihop');

    expect(screen.queryByRole('list', { name: 'Top three' })).not.toBeInTheDocument();
    const rows = within(screen.getByRole('list', { name: 'Chains' })).getAllByRole('link');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(/^3/); // its rank among all restaurants
    expect(rows[0]).toHaveTextContent('IHOP');
    expect(router.state.location.search).toEqual({ q: 'ihop' });
  });

  it('shows initials when there is no logo', async () => {
    seedBoard();
    renderApp('/');
    const podium = await screen.findByRole('list', { name: 'Top three' });
    expect(within(podium).getByText('ZC')).toBeInTheDocument();
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
