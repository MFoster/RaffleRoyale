const { createHash } = require('node:crypto');

const SIGNATURE_FIELD = 'sig';

function signQueuePayload(payload, signingKey) {
  if (!signingKey) {
    throw new Error('QUEUE_MESSAGE_SIGNING_KEY is required to sign queue messages');
  }

  const unsignedPayload = removeSignatureField(payload);
  const signature = createSignature(unsignedPayload, signingKey);
  return { ...unsignedPayload, [SIGNATURE_FIELD]: signature };
}

function verifyQueuePayload(payload, signingKey) {
  if (!signingKey) {
    throw new Error('QUEUE_MESSAGE_SIGNING_KEY is required to verify queue messages');
  }

  const receivedSignature = payload[SIGNATURE_FIELD];
  if (typeof receivedSignature !== 'string' || !receivedSignature) {
    throw new Error('Queue message missing required sig property');
  }

  const unsignedPayload = removeSignatureField(payload);
  const expectedSignature = createSignature(unsignedPayload, signingKey);
  if (receivedSignature !== expectedSignature) {
    throw new Error('Queue message signature verification failed');
  }

  return unsignedPayload;
}

function parseAndVerifyQueueMessage(messageBody, signingKey) {
  const parsed = JSON.parse(messageBody);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Queue message body must be a JSON object');
  }

  return verifyQueuePayload(parsed, signingKey);
}

function removeSignatureField(payload) {
  const next = { ...payload };
  delete next[SIGNATURE_FIELD];
  return next;
}

function createSignature(payload, signingKey) {
  const canonicalPayload = stableStringify(payload);
  return createHash('sha256').update(canonicalPayload).update(signingKey).digest('hex');
}

function stableStringify(input) {
  return JSON.stringify(sortValue(input));
}

function sortValue(input) {
  if (Array.isArray(input)) {
    return input.map((item) => sortValue(item));
  }

  if (input && typeof input === 'object') {
    return Object.keys(input)
      .sort()
      .reduce((result, key) => {
        result[key] = sortValue(input[key]);
        return result;
      }, {});
  }

  return input;
}

module.exports = {
  signQueuePayload,
  verifyQueuePayload,
  parseAndVerifyQueueMessage,
};
