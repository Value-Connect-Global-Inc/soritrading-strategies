/*
 * @coinsori-strategy v1
 * name: ETH 4H Trend Dip Rider
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 1000
 *
 * Trend following on ETH 4h: we only buy when the 4-hour trend is clearly up (the slow 200-bar average is rising and price is above it), and we buy small dips inside that uptrend. We sell when the trend breaks down below the 200-bar average or when a trade drops 30% below our entry, so no single trade can hurt the account much.
 * When it does NOT work: long sideways chop where the slow average is flat — we whipsaw in and out and pay fees without a trend to ride.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 11); // slope of the trend line over the last 10 bars
  const rsi14 = ctx.rsi(14, 1);
  if (sma200 == null || sma200Prev == null || rsi14 == null) return null;

  const inPos = ctx.position > 0.000001;

  if (!inPos) {
    // Do not open new positions while allocation is unhealthy (reduce-only edge).
    if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

    const uptrend = sma200 > sma200Prev; // slow average still rising
    const above = price > sma200;        // price above the trend line
    const dip = rsi14 < 45;              // mild pullback: RSI in the neutral zone, not overbought

    ctx.watch([{
      side: 'buy',
      price: sma200,
      trigger: 'above',
      note: 'trend line hold',
      conds: [
        { label: 'SMA200 rising', ok: uptrend },
        { label: 'RSI(14) dip', now: rsi14, op: '<', ref: 45, closed: true }
      ]
    }]);

    if (uptrend && above && dip) {
      const qty = (ctx.cash / price) * 0.95;
      return { side: 'buy', qty };
    }
    return null;
  }

  // In a position: exit when the trend breaks or on a hard stop.
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.70 : null; // 30% max loss per trade (catastrophe guard)
  const watchList = [{ side: 'sell', price: sma200, trigger: 'below', note: 'trend break' }];
  if (stop != null) watchList.push({ side: 'sell', price: stop, trigger: 'below', note: '30% stop' });
  ctx.watch(watchList);

  if (price < sma200 || (stop != null && price <= stop)) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
