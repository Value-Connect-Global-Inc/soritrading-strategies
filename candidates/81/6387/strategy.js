/*
 * @coinsori-strategy v1
 * name: BTC 4H Trend Regime Pullback
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: In a confirmed uptrend (price above the 200-bar average and the fast 50-bar average above the slow one), dips back to the 20-bar average usually resume the trend, giving a good risk/reward entry.
 * When it buys and sells: It buys when the uptrend filter is on and price pulls back to the 20-bar average; it closes when the stop or target is hit, or when the 200-bar trend filter flips down.
 * When it does NOT work: In choppy sideways markets the trend filter switches often and pullback entries get stopped out repeatedly, paying fees each time.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;

  // Closed-bar indicators (ago>=1) so backtest, paper and live all see the same value.
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma50 == null || ema20 == null || atr == null) return null;

  const uptrend = sma50 > sma200;      // fast average above slow average = trend up
  const prevClose = ctx.closes.at(-2); // last closed bar (matches ago=1)

  if (pos <= 0) {
    // Regime filter: only buy when the 200-bar trend agrees.
    const regimeOk = prevClose > sma200 && uptrend;
    if (regimeOk && price <= ema20 * 1.01) {
      const stop = price - 2.5 * atr; // ~2.5x daily range below entry = hard stop
      const tp = price + 4 * atr;     // ~1.6 reward-to-risk on the stop
      const qty = (ctx.cash * 0.5) / price; // use half the cash per trade, never full margin
      ctx.watch([
        { side: 'buy', price: ema20, trigger: 'below', note: 'EMA20 pullback', conds: [{ label: 'SMA200 uptrend', ok: regimeOk }] },
        { side: 'sell', price: stop, trigger: 'below', note: 'stop' },
        { side: 'sell', price: tp, trigger: 'above', note: 'target' }
      ]);
      return { side: 'buy', qty };
    }
    ctx.watch([
      { side: 'buy', price: ema20, trigger: 'below', note: 'EMA20 pullback', conds: [{ label: 'SMA200 uptrend', ok: regimeOk }] }
    ]);
    return null;
  }

  // In a position: stop, target, or trend flip closes it.
  const entryPx = ctx.entryPx;
  if (entryPx == null) {
    // We hold but cannot read the entry price — wait rather than act on a guess.
    ctx.watch([]);
    return null;
  }
  const stop = entryPx - 2.5 * atr;
  const tp = entryPx + 4 * atr;
  const exitNow = price <= stop || price >= tp || prevClose < sma200;
  ctx.watch([
    { side: 'sell', price: stop, trigger: 'below', note: 'stop' },
    { side: 'sell', price: tp, trigger: 'above', note: 'target' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'trend flip' }
  ]);
  if (exitNow) return { side: 'sell', qty: pos, reduceOnly: true };
  return null;
}
