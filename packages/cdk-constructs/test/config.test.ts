import assert from 'node:assert/strict';
import test from 'node:test';
import {
  apiInternalUrl,
  privateNamespaceName,
  resourcePrefix,
} from '../src/config';

const config = {
  projectName: 'raffle-royale',
  environmentName: 'nonprod',
};

test('naming helpers produce stable environment-scoped names', () => {
  assert.equal(resourcePrefix(config), 'raffle-royale-nonprod');
  assert.equal(
    privateNamespaceName(config),
    'nonprod.raffle-royale.internal',
  );
  assert.equal(
    apiInternalUrl(config),
    'http://api.nonprod.raffle-royale.internal:3001',
  );
});
