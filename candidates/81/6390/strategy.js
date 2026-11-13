/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Usage Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's daily active addresses measure real network usage.
 * Historically, sustained growth in active addresses has accompanied bull markets
 * and sustained contraction has preceded bear markets, so on-chain usage works as
 * a slow fundamental regime filter on top of a long-term price trend.
 * When it buys and sells: Buy only in a confirmed bull market: the 50-day average
 * above the 200-day average (golden-cross regime) AND on-chain usage expanding
 * (active addresses above their 30-day average) AND price above the 50-day
 * average. Sell when price closes below the 50-day average, or when usage starts
 * contracting, or on a hard 3x ATR stop.
 * When it does NOT work: In a choppy sideways market the filters flip often and
 * the strategy whipsaws. A speculative melt-up with flat on-chain usage
 * (addresses not growing) is missed entirely.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const addr = ctx.data("addr");             // daily unique active addresses
  const addrSma30 = ctx.data("addr_sma30");  // 30-day average of active addresses
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (addr == null || addrSma30 == null || ema50 == null || ema200 == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const prevClose = ctx.closes.at(-2); // last closed bar (matches ago=1)

  // Regime: on-chain usage expanding = addresses above their 30-day average.
  const usageUp = addr > addrSma30;
  // Bull market: the 50-day average above the 200-day average (golden cross).
  const bull = ema50 > ema200;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    if (entryPx == null) { ctx.watch([]); return null; }
    // Hard stop: 3x daily range below entry caps the loss on any single dip.
    const stop = entryPx - 3 * atr;
    const watch = [
      { side: 'sell', price: stop, trigger: 'below', note: 'stop' },
      { side: 'sell', price: ema50, trigger: 'below', note: 'trend broke' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'usage exit',
        conds: [{ label: 'addr > sma30', ok: usageUp }] }
    ];
    // Exit on the hard stop, a broken 50-day trend, or fading on-chain usage.
    if (price <= stop || prevClose < ema50 || !usageUp) {
      ctx.watch(watch);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch(watch);
    return null;
  }

  // Flat: buy only in a confirmed bull market with expanding on-chain usage
  // and price above the 50-day average (avoids bear-market rally entries).
  const watch = [{
    side: 'buy', price: ema50, trigger: 'above', note: 'bull+usage buy',
    conds: [
      { label: 'EMA50>EMA200', ok: bull },
      { label: 'addr > sma30', ok: usageUp }
    ]
  }];
  if (bull && usageUp && prevClose > ema50) {
    const qty = (ctx.cash / price) * 0.98; // 98% of cash into the position
    ctx.watch(watch);
    return { side: 'buy', qty };
  }
  ctx.watch(watch);
  return null;
}
