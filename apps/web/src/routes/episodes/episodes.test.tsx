import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { seedEpisodes } from '@/test/fixtures';
import { renderApp } from '@/test/renderApp';

describe('episode list', () => {
  it('shows the main show, newest first, and switches to the Double', async () => {
    seedEpisodes();
    renderApp('/episodes');

    const list = await screen.findByRole('list', { name: 'Episodes' });
    expect(
      within(list)
        .getAllByRole('link')
        .map((l) => l.querySelector('span span')?.textContent),
    ).toEqual(['IHOP with Alison Agosti', 'Taco Bell with Jack Allison']);

    await userEvent.click(screen.getByRole('tab', { name: 'Double' }));
    expect(
      within(screen.getByRole('list', { name: 'Episodes' })).getByRole('link', {
        name: /Mama Celeste/,
      }),
    ).toBeInTheDocument();
  });

  it('searches guests', async () => {
    seedEpisodes();
    renderApp('/episodes?series=all');

    await userEvent.type(await screen.findByRole('searchbox'), 'sandy');

    expect(
      within(screen.getByRole('list', { name: 'Episodes' })).getAllByRole('link'),
    ).toHaveLength(1);
  });
});

describe('episode page', () => {
  it("shows each person's rating and order, and links to the wiki", async () => {
    seedEpisodes();
    renderApp(`/episodes/${encodeURIComponent('IHOP with Alison Agosti')}`);

    expect(
      await screen.findByRole('heading', { name: 'IHOP with Alison Agosti' }),
    ).toBeInTheDocument();
    expect(screen.getByText('With Alison Agosti, Dave Ferguson')).toBeInTheDocument();
    const ratings = screen.getByRole('region', { name: 'Ratings' });
    expect(within(ratings).getByText('Nick Wiger').closest('[data-slot=card]')).toHaveTextContent(
      'Nick Wiger4 forksCoffeeSplashberry',
    );
    expect(within(ratings).getByText('-')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Read more/ })).toHaveAttribute(
      'href',
      'https://doughboys.fandom.com/wiki/IHOP%20with%20Alison%20Agosti',
    );
  });

  it('shows an error for an unknown episode', async () => {
    renderApp('/episodes/nope');
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });
});
