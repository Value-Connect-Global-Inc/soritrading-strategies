/*
 * @coinsori-strategy v1
 * name: BTC EMA-Pullback Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a confirmed uptrend, sharp pullbacks to the 20-EMA with an oversold RSI
 * tend to revert back up. This is a mean-reversion entry — the opposite mechanism of the
 * breakout-trend strategy, so it works in different conditions.
 * When it buys and sells: buys when price pulls back to the 20-EMA with RSI(14) below 40 while
 * the 200-EMA trend is rising; sells when price recovers to the 20-EMA, the trend dies, or a
 * hard 2.5xATR stop is hit.
 * When it does NOT work: strong one-way crashes where pullbacks keep extending (no reversion),
 * and flat chop where the 200-EMA gate keeps flipping. Fees matter — this is a fast strategy.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const cash = ctx.cash;
  const inPos = ctx.position > 0;

  const ema20 = ctx.ema(20, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200b = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  if (ema20 == null || rsi == null || sma200 == null || sma200b == null || atr == null) return null;

  const uptrend = sma200 > sma200b;          // regime gate: only buy pullbacks in an uptrend
  const atrPct = atr / price;

  // Entry: price pulled back to (or through) the 20-EMA while oversold in an uptrend.
  const wantBuy = !inPos && uptrend && price <= ema20 && rsi < 40;

  // Exit: reversion to the 20-EMA, hard stop at 2.5xATR below entry, or trend death.
  const stop = inPos && ctx.entryPx != null ? ctx.entryPx - 2.5 * atr : null;
  const trendDead = inPos && sma200 <= sma200b;
  const wantSell = inPos && (price >= ema20 || trendDead || (stop != null && price <= stop));

  const watch = [
    { side: 'buy', price: ema20, trigger: 'below', note: 'pullback to EMA20',
      conds: [ { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
               { label: 'SMA200 rising', ok: uptrend } ] },
    { side: 'sell', price: ema20, trigger: 'above', note: 'recovered to EMA20' }
  ];
  if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'hard stop' });
  ctx.watch(watch);

  if (wantSell) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  if (wantBuy) {
    // Vol-target sizing: aim ~2% daily vol (fast strategy, small edge per trade), cap at 80% of cash.
    let pct = 0.8;
    if (atrPct > 0) pct = Math.min(0.8, 0.02 / atrPct);
    const qty = (cash * pct) / price;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
