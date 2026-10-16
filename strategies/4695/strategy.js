/*
 * @coinsori-strategy v1
 * name: trivial buy probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: DEBUG probe — verify the engine actually runs onUpdate and executes orders.
 * When it buys and sells: buys 0.001 BTC on every bar (should produce thousands of trades).
 * When it does NOT work: n/a.
 */
function onUpdate(ctx) {
  return { side: 'buy', qty: 0.001 };
}
