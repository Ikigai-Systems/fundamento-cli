import { test } from 'node:test';
import assert from 'node:assert';
import { FundamentoClient } from '../src/client.js';
import { Config } from '../src/config.js';

test('FundamentoClient should be instantiated with config', () => {
  const config = new Config({ apiKey: 'test-key' });
  const client = new FundamentoClient(config);

  assert.ok(client);
  assert.strictEqual(client.config.apiKey, 'test-key');
});

test('FundamentoClient should set Authorization header', () => {
  const config = new Config({ apiKey: 'test-key' });
  const client = new FundamentoClient(config);

  assert.strictEqual(
    client.axios.defaults.headers['Authorization'],
    'Bearer test-key'
  );
});

test('FundamentoClient should set base URL', () => {
  const config = new Config({
    apiKey: 'test-key',
    baseUrl: 'http://localhost:3000'
  });
  const client = new FundamentoClient(config);

  assert.strictEqual(client.axios.defaults.baseURL, 'http://localhost:3000');
});
