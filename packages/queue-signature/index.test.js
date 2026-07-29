const assert = require('node:assert/strict');
const test = require('node:test');
const {
  JOB_COMMANDS,
  createRaffleExpirationJob,
  parseAndVerifyQueueMessage,
  signQueuePayload,
} = require('./index.js');

test('creates a deterministic raffle expiration job', () => {
  assert.deepEqual(createRaffleExpirationJob('raffle-1'), {
    id: 'raffle-expiration:raffle-1',
    command: JOB_COMMANDS.EXPIRE_RAFFLE,
    args: ['raffle-1'],
  });
});

test('signs and verifies a raffle expiration job', () => {
  const payload = createRaffleExpirationJob('raffle-1');
  const signed = signQueuePayload(payload, 'test-key');

  assert.deepEqual(
    parseAndVerifyQueueMessage(JSON.stringify(signed), 'test-key'),
    payload,
  );
});
