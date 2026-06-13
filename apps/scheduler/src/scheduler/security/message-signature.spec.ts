import {
  parseAndVerifyQueueMessage,
  signQueuePayload,
  verifyQueuePayload,
} from '@raffleroyale/queue-signature';

describe('message-signature', () => {
  const signingKey = 'test-shared-key';

  it('signs payloads with deterministic sig', () => {
    const signed = signQueuePayload(
      {
        raffleId: '123',
        nested: { b: 2, a: 1 },
      },
      signingKey,
    );

    expect(typeof signed.sig).toBe('string');
    expect(signed.sig).toHaveLength(64);
  });

  it('verifies a valid signed payload', () => {
    const signed = signQueuePayload({ raffleId: '123', type: 'RaffleExpiration' }, signingKey);
    const verified = verifyQueuePayload(signed, signingKey);
    expect(verified).toEqual({ raffleId: '123', type: 'RaffleExpiration' });
  });

  it('rejects payloads missing sig', () => {
    expect(() => verifyQueuePayload({ type: 'RaffleExpiration' }, signingKey)).toThrow(
      'Queue message missing required sig property',
    );
  });

  it('rejects payloads with invalid sig', () => {
    const signed = signQueuePayload({ raffleId: '123' }, signingKey);
    expect(() => verifyQueuePayload({ ...signed, raffleId: 'different' }, signingKey)).toThrow(
      'Queue message signature verification failed',
    );
  });

  it('parses and verifies a message body string', () => {
    const signed = signQueuePayload({ type: 'RaffleExpiration', raffleId: '42' }, signingKey);
    const verified = parseAndVerifyQueueMessage(JSON.stringify(signed), signingKey);
    expect(verified).toEqual({ type: 'RaffleExpiration', raffleId: '42' });
  });
});
