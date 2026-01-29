const test = require('node:test');
const assert = require('node:assert');
const { parseAsusOutput } = require('../server/parser');

test('ASUS Parser - Valid eth0 output', (t) => {
    const mockOutput = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
  eth0: 1000000    1234    0    0    0     0          0         0  500000     567    0    0    0     0       0          0
    lo:    5000      50    0    0    0     0          0         0    5000      50    0    0    0     0       0          0`;

    const result = parseAsusOutput(mockOutput);

    assert.strictEqual(result.rx, 1000000);
    assert.strictEqual(result.tx, 500000);
});

test('ASUS Parser - Invalid output returns null', (t) => {
    const mockOutput = `nothing here`;
    const result = parseAsusOutput(mockOutput);
    assert.strictEqual(result, null);
});

test('ASUS Parser - Handles ppp0 interface', (t) => {
    const mockOutput = `  ppp0: 2000000       0    0    0    0     0          0         0  800000       0    0    0    0     0       0          0`;
    const result = parseAsusOutput(mockOutput);
    assert.strictEqual(result.rx, 2000000);
    assert.strictEqual(result.tx, 800000);
});
