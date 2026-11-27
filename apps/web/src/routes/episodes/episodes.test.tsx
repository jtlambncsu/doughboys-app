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
    ).toEqual([
      'Chipotle 4 with Raina Huang',
      'IHOP with Alison Agosti',
      'Taco Bell with Jack Allison',
    ]);

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

describe('episode to chain', () => {
  it('links the restaurant to its chain page', async () => {
    seedEpisodes();
    renderApp(`/episodes/${encodeURIComponent('IHOP with Alison Agosti')}`);

    await userEvent.click(await screen.findByRole('link', { name: 'IHOP' }));

    expect(await screen.findByRole('heading', { name: 'IHOP', level: 1 })).toBeInTheDocument();
  });
});

describe('episode page extras', () => {
  const ihop = `/episodes/${encodeURIComponent('IHOP with Alison Agosti')}`;

  it('shows the synopsis and the Snack or Wack', async () => {
    seedEpisodes();
    renderApp(ihop);

    expect(await screen.findByText(/welcome guest Alison Agosti/)).toBeInTheDocument();
    expect(screen.getByText('They play Snack or Wack.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Snack or Wack' })).toHaveTextContent('SweeTarts');
  });

  it('shows three quotes, then all of them on request', async () => {
    seedEpisodes();
    renderApp(ihop);

    const quotes = await screen.findByRole('region', { name: 'Quotes' });
    expect(within(quotes).getAllByRole('figure')).toHaveLength(3);
    expect(within(quotes).getByText('“Mitch: Tip twenty percent.”')).toBeInTheDocument();
    expect(within(quotes).getByText('— Mike Mitchell')).toBeInTheDocument();

    await userEvent.click(within(quotes).getByRole('button', { name: 'Show all 4 quotes' }));
    expect(within(quotes).getAllByRole('figure')).toHaveLength(4);
  });

  it('keeps Nick’s intro folded until opened', async () => {
    seedEpisodes();
    renderApp(ihop);

    const trigger = await screen.findByRole('button', { name: 'Nick’s intro' });
    expect(screen.queryByText('The year was 1958.')).not.toBeInTheDocument();
    await userEvent.click(trigger);
    expect(screen.getByText('The year was 1958.')).toBeInTheDocument();
  });

  it('shows roasts and links related episodes', async () => {
    seedEpisodes();
    renderApp(ihop);

    expect(await screen.findByRole('region', { name: 'Roast Spoonman' })).toHaveTextContent(
      'A walking syrup spill',
    );
    await userEvent.click(screen.getByRole('link', { name: 'Taco Bell with Jack Allison' }));
    expect(
      await screen.findByRole('heading', { name: 'Taco Bell with Jack Allison', level: 1 }),
    ).toBeInTheDocument();
  });
});

describe('new episodes from the podcast feed', () => {
  it('are marked new in the list', async () => {
    seedEpisodes();
    renderApp('/episodes');

    const row = await screen.findByRole('link', { name: /Chipotle 4 with Raina Huang/ });
    expect(within(row).getByText('New')).toBeInTheDocument();
  });

  it('explain that ratings are coming, and credit the feed instead of the wiki', async () => {
    seedEpisodes();
    renderApp(`/episodes/${encodeURIComponent('Chipotle 4 with Raina Huang')}`);

    expect(
      await screen.findByText(/Just released\. Ratings, orders and quotes/),
    ).toBeInTheDocument();
    expect(screen.getByText(/before a review of Chipotle/)).toBeInTheDocument();
    expect(screen.getByText('Synopsis from the official podcast feed.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Read more/ })).not.toBeInTheDocument();
  });
});
