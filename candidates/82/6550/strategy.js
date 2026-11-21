/*
 * @coinsori-strategy v1
 * name: BTC Onchain Adoption Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's on-chain activity (daily unique active addresses)
 * is a slow, crypto-native regime signal — network usage expands in bull markets
 * and contracts in bear markets. It is a different data axis from price alone.
 * When it buys and sells: Buy when network usage is above its own 30-day average
 * (adoption expanding) AND price is above its 200-day average (long uptrend).
 * Sell when price closes below its 50-day average (trend broken) or usage
 * contracts clearly below its own average (ratio < 0.95).
 * When it does NOT work: In choppy range markets the gate can flip on and off,
 * paying fees without a trend. Adoption data is slow, so it lags sharp V-shaped
 * recoveries and can miss the first leg of a new bull market.
 */
function onUpdate(ctx) {
  const addr = ctx.data("addr");
  const addrSma = ctx.data("addr_sma30");
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  if (addr == null || addrSma == null || addrSma <= 0 || sma200 == null || sma50 == null) return null;
  const ratio = addr / addrSma; // 1 = usage at its own 30-day average
  const close = ctx.closes.at(-2);
  if (close == null) return null;

  if (ctx.position <= 0) {
    if (ratio > 1.0 && close > sma200) {
      ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend',
        conds: [{ label: 'addr ratio', now: ratio, op: '>', ref: 1.0, closed: true }] }]);
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend',
      conds: [{ label: 'addr ratio', now: ratio, op: '>', ref: 1.0, closed: true }] }]);
    return null;
  }

  if (close < sma50 || ratio < 0.95) {
    ctx.watch([{ side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 break',
      conds: [{ label: 'addr ratio', now: ratio, op: '<', ref: 0.95, closed: true }] }]);
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  ctx.watch([{ side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 break',
    conds: [{ label: 'addr ratio', now: ratio, op: '<', ref: 0.95, closed: true }] }]);
  return null;
}
