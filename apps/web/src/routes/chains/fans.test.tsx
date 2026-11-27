import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { db } from '@/test/server';
import { renderApp } from '@/test/renderApp';

function seedTacoBell() {
  db.add({
    slug: 'Taco Bell with Jack Allison',
    restaurant: 'Taco Bell',
    averageForks: 4.33,
    releaseDate: '2015-05-25',
    ratings: [
      {
        person: 'Nick Wiger',
        forks: 4,
        unit: 'forks',
        raw: '4',
        ordered: ['Crunchwrap Supreme', 'Baja Blast'],
      },
      {
        person: 'Mike Mitchell',
        forks: 5,
        unit: 'forks',
        raw: '5',
        ordered: ['Crunchwrap Supreme'],
      },
    ],
  });
}

const page = '/chains/taco-bell';

describe('rating a chain', () => {
  it('asks signed-out fans to sign in', async () => {
    seedTacoBell();
    const { fan } = renderApp(page, { signedIn: false });

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in to rate' }));

    expect(fan.signIn).toHaveBeenCalled();
  });

  it('asks for a display name first, and checks it', async () => {
    seedTacoBell();
    renderApp(page);

    const form = await screen.findByRole('form', { name: 'Display name' });
    const input = within(form).getByRole('textbox', { name: 'Display name' });
    await userEvent.type(input, 'x');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await within(form).findByText('At least 2 characters')).toBeInTheDocument();

    await userEvent.type(input, 'ylophone fan');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Rate it' })).toBeInTheDocument();
    expect(db.displayName).toBe('xylophone fan');
  });

  it('saves forks, order, location and review', async () => {
    seedTacoBell();
    db.displayName = 'Spoon Fan';
    renderApp(page);

    await userEvent.click(await screen.findByRole('button', { name: 'Rate it' }));
    const form = screen.getByRole('form', { name: 'Rate Taco Bell' });

    // 3 forks by default; one step right is 3.5.
    const slider = within(form).getByRole('slider');
    act(() => slider.focus());
    await userEvent.keyboard('{ArrowRight}');
    expect(within(form).getByText('3.5')).toBeInTheDocument();

    // The menu comes from what the boys ordered, most ordered first.
    const suggestions = await within(form).findByRole('group', { name: 'Menu suggestions' });
    expect(
      within(suggestions)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Crunchwrap Supreme', 'Baja Blast']);
    await userEvent.click(within(suggestions).getByRole('button', { name: 'Crunchwrap Supreme' }));
    await userEvent.type(
      within(form).getByLabelText('Search the menu'),
      'Doritos Locos Taco{Enter}',
    );
    expect(within(form).getByRole('list', { name: 'Your order' })).toHaveTextContent(
      'Crunchwrap SupremeDoritos Locos Taco',
    );

    await userEvent.type(within(form).getByLabelText('Where? (optional)'), 'Burbank, CA');
    await userEvent.type(within(form).getByLabelText('Your review (optional)'), 'Live más.');
    await userEvent.click(within(form).getByRole('button', { name: 'Save rating' }));

    expect(await screen.findByText('Thanks for rating Taco Bell!')).toBeInTheDocument();
    expect(db.ratingRequests).toEqual([
      {
        forks: 3.5,
        ordered: ['Crunchwrap Supreme', 'Doritos Locos Taco'],
        location: 'Burbank, CA',
        review: 'Live más.',
      },
    ]);
    const reviews = await screen.findByRole('list', { name: 'Fan reviews' });
    expect(reviews).toHaveTextContent('Spoon Fan');
    expect(reviews).toHaveTextContent('Live más.');
    expect(await screen.findByText(/You gave it/)).toHaveTextContent('You gave it 3.5 forks.');
  });

  it('edits and deletes your rating', async () => {
    seedTacoBell();
    db.displayName = 'Spoon Fan';
    db.fanRatings.push({
      chain: 'taco-bell',
      owner: 'me',
      displayName: 'Spoon Fan',
      forks: 2,
      ordered: [],
      updatedAt: '2026-12-01T00:00:00Z',
    });
    renderApp(page);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit your rating' }));
    const form = screen.getByRole('form', { name: 'Rate Taco Bell' });
    expect(within(form).getByText('2')).toBeInTheDocument();
    await userEvent.click(within(form).getByRole('button', { name: 'Delete my rating' }));

    expect(await screen.findByText('Rating deleted')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Rate it' })).toBeInTheDocument();
    expect(db.fanRatings).toEqual([]);
  });
});

describe('scores', () => {
  it('compares the Doughboys with fans once three fans have rated', async () => {
    seedTacoBell();
    db.addFanRating('taco-bell', { displayName: 'A', forks: 5 });
    db.addFanRating('taco-bell', { displayName: 'B', forks: 4 });
    renderApp(page, { signedIn: false });

    const scores = await screen.findByRole('group', { name: 'Scores' });
    expect(scores).toHaveTextContent('The Doughboys4.33 forks');
    expect(await within(scores).findByText('2 ratings so far; shows at 3')).toBeInTheDocument();
  });

  it('shows the fans’ average with enough ratings, on the chain page and leaderboard', async () => {
    seedTacoBell();
    for (const [name, forks] of [
      ['A', 5],
      ['B', 4],
      ['C', 3],
    ] as const) {
      db.addFanRating('taco-bell', { displayName: name, forks });
    }
    renderApp(page, { signedIn: false });
    const scores = await screen.findByRole('group', { name: 'Scores' });
    expect(await within(scores).findByText('3 ratings')).toBeInTheDocument();
    expect(scores).toHaveTextContent('Fans4 forks');
  });

  it('shows fans’ scores on the leaderboard', async () => {
    seedTacoBell();
    for (const [name, forks] of [
      ['A', 5],
      ['B', 4],
      ['C', 3],
    ] as const) {
      db.addFanRating('taco-bell', { displayName: name, forks });
    }
    renderApp('/', { signedIn: false });
    const podium = await screen.findByRole('list', { name: 'Top three' });
    expect(podium).toHaveTextContent('Fans 4');
  });
});

describe('account page', () => {
  it('asks signed-out visitors to sign in', async () => {
    renderApp('/me', { signedIn: false });
    const main = await screen.findByRole('main');
    expect(await within(main).findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('lists your ratings and lets you change your name', async () => {
    seedTacoBell();
    db.displayName = 'Spoon Fan';
    db.fanRatings.push({
      chain: 'taco-bell',
      owner: 'me',
      displayName: 'Spoon Fan',
      forks: 4,
      ordered: [],
      updatedAt: '2026-12-01T00:00:00Z',
    });
    renderApp('/me');

    expect(await screen.findByRole('list', { name: 'Your ratings' })).toHaveTextContent(
      'taco-bell',
    );
    expect(screen.getByText(/Signed in as fan@example.com/)).toBeInTheDocument();
    const input = await screen.findByRole('textbox', { name: 'Display name' });
    expect(input).toHaveValue('Spoon Fan');
    await userEvent.clear(input);
    await userEvent.type(input, 'Spoonman');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText('Display name saved')).length).toBeGreaterThan(0);
    expect(db.displayName).toBe('Spoonman');
    expect(db.profileSaves).toBe(1);
  });

  it('deletes the account only after typing “delete”', async () => {
    db.displayName = 'Spoon Fan';
    const { fan, router } = renderApp('/me');

    await userEvent.click(await screen.findByRole('button', { name: 'Delete my account' }));
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete everything' });
    expect(confirm).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText('Type delete to confirm'), 'delete');
    await userEvent.click(confirm);

    expect(await screen.findByText('Your account and ratings are deleted')).toBeInTheDocument();
    expect(db.accountDeleted).toBe(true);
    expect(fan.forget).toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/');
  });
});
