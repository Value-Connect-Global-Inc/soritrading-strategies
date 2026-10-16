/*
 * @coinsori-strategy v1
 * name: BTC Trend-Pullback Dip Buy 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In established crypto bull markets price tends to keep
 * making higher highs, and shallow pullbacks toward the 50-day average are
 * bought by dip-buyers rather than marking the start of a downtrend. This
 * strategy only buys those dips when the long-term trend is already up, so it
 * avoids catching falling knives (unlike pure mean reversion) and avoids paying
 * up at breakouts (unlike breakout systems).
 * When it buys and sells: buys when the 200-day average is rising and price has
 * pulled back to within half an ATR of the 50-day average while still above the
 * 200-day average; sells when price closes below the 200-day average, breaks the
 * 20-day low, or falls 2.5x ATR from entry.
 * When it does NOT work: in a long flat/choppy market with no trend the 200-day
 * average is not rising so it stays in cash (safe but idle); and in a sharp
 * crash that gaps through the stop, the 2.5-ATR stop limits but does not
 * eliminate the loss.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const ema200Prev = ctx.ema(200, 30);   // 200d average 30 bars ago, to judge direction
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || ema200Prev == null || atr == null) return null;
  if (atr <= 0) return null;

  const c = ctx.closes;
  if (c.length < 40) return null;
  const prevClose = c.at(-2);            // last CLOSED bar

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) return null;
    const stopPx = entry - 2.5 * atr;    // risk control: 2.5x daily ATR from entry
    const low20 = ctx.low(20, 1);
    const trendBroken = prevClose < ema200;
    const lowBreak = low20 != null && prevClose < low20;
    if (prevClose <= stopPx || trendBroken || lowBreak) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '2.5 ATR stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200d trend break' },
               { side: 'sell', price: low20 == null ? 0 : low20, trigger: 'below', note: '20d low' }]);
    return null;
  }

  const bull = ema200 > ema200Prev;                    // 200d average rising = bull regime
  const pullback = prevClose <= ema50 + 0.5 * atr;     // price dipped to the 50d average
  const above200 = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema50 + 0.5 * atr, trigger: 'below', note: 'pullback to 50d EMA',
               conds: [{ label: '200d rising', ok: bull, closed: true },
                       { label: 'close > 200d', ok: above200, closed: true }] }]);
  if (!bull || !pullback || !above200) return null;

  // volatility-scaled size: smaller position when the market is wild
  const atrPct = atr / prevClose;
  const scale = Math.min(1, 0.03 / atrPct);
  const qty = (ctx.cash * 0.95 * scale) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
