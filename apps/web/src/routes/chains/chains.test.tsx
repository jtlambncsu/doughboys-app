import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { db } from '@/test/server';
import { renderApp } from '@/test/renderApp';

function seedTacoBell() {
  db.chains.set('Taco Bell', { name: 'Taco Bell', category: 'restaurant', domain: 'tacobell.com' });
  db.add({
    slug: 'Taco Bell with Jack Allison',
    number: '2',
    restaurant: 'Taco Bell',
    releaseDate: '2015-05-25',
    averageForks: 4.33,
    ratings: [
      { person: 'Nick Wiger', forks: 4.5, unit: 'forks', raw: '4.5 forks', ordered: [] },
      { person: 'Mike Mitchell', forks: 4, unit: 'forks', raw: '4 forks', ordered: [] },
    ],
  });
  db.add({
    slug: 'Taco Bell 2 with Jon Gabrus',
    number: '86',
    restaurant: 'Taco Bell',
    releaseDate: '2017-01-26',
    averageForks: 4.67,
  });
  db.add({
    slug: 'Taco Bell 4 with Gillian Jacobs',
    number: '156',
    restaurant: 'Taco Bell',
    releaseDate: '2018-05-31',
    averageForks: 4,
  });
  db.add({
    slug: 'Munch Madness: Dough Quiero Talk-O-Bell',
    number: '436',
    restaurant: 'Taco Bell',
    releaseDate: '2024-03-07',
  });
}

const chainUrl = (name: string) => `/chains/${encodeURIComponent(name)}`;

describe('chain page', () => {
  it('lists every rated visit, newest first, with the change from the visit before', async () => {
    seedTacoBell();
    renderApp(chainUrl('Taco Bell'));

    expect(await screen.findByRole('heading', { name: 'Taco Bell', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('4 visits · 3 rated')).toBeInTheDocument();

    const visits = within(screen.getByRole('list', { name: 'Rated visits' })).getAllByRole('link');
    expect(
      visits.map((v) => v.querySelector('.font-medium + p, p.font-medium')?.textContent),
    ).toEqual([
      'Taco Bell 4 with Gillian Jacobs',
      'Taco Bell 2 with Jon Gabrus',
      'Taco Bell with Jack Allison',
    ]);
    expect(visits[0]).toHaveTextContent('Visit 3');
    expect(visits[0]).toHaveTextContent('Down 0.67 from last visit');
    expect(visits[1]).toHaveTextContent('Up 0.34 from last visit');
    expect(within(visits[2]!).getByRole('list', { name: 'Scores' })).toHaveTextContent(
      'Nick 4.5Mike 4',
    );
  });

  it('shows a score chart when there are several rated visits', async () => {
    seedTacoBell();
    renderApp(chainUrl('Taco Bell'));

    expect(await screen.findByText('Score over time')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Scores for 3 rated visits' })).toBeInTheDocument();
  });

  it('lists episodes without a rating separately', async () => {
    seedTacoBell();
    renderApp(chainUrl('Taco Bell'));

    const others = await screen.findByRole('list', { name: 'Other episodes' });
    expect(within(others).getByRole('link')).toHaveTextContent('Munch Madness');
  });

  it('opens an episode from a visit', async () => {
    seedTacoBell();
    renderApp(chainUrl('Taco Bell'));

    await userEvent.click(await screen.findByRole('link', { name: /Taco Bell 2 with Jon Gabrus/ }));

    expect(
      await screen.findByRole('heading', { name: 'Taco Bell 2 with Jon Gabrus' }),
    ).toBeInTheDocument();
  });

  it('handles names that need escaping in the URL', async () => {
    db.add({ slug: 'Which Wich? with X', restaurant: 'Which Wich?', averageForks: 3 });
    renderApp(chainUrl('Which Wich?'));

    expect(
      await screen.findByRole('heading', { name: 'Which Wich?', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Score over time')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The visit' })).toBeInTheDocument();
  });

  it('shows an error for an unknown chain', async () => {
    renderApp(chainUrl('Nope'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });
});
