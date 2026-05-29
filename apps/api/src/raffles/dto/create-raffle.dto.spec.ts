import { validate } from 'class-validator';
import { CreateRaffleDto } from './create-raffle.dto';

describe('CreateRaffleDto', () => {
  const buildDto = (imageUrls?: string[]): CreateRaffleDto =>
    Object.assign(new CreateRaffleDto(), {
      rafflerId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Raffle title',
      totalTickets: 10,
      ticketPrice: 500,
      endTime: new Date(Date.now() + 60_000).toISOString(),
      imageUrls,
    });

  it('accepts image URLs from the raffle uploads path', async () => {
    const dto = buildDto([
      '/api/uploads/raffles/a.png',
      '/api/uploads/raffles/another-image.webp',
    ]);

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects image URLs outside the raffle uploads path', async () => {
    const dto = buildDto(['https://example.com/image.png']);

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors.some((error) => error.property === 'imageUrls')).toBe(true);
  });
});
