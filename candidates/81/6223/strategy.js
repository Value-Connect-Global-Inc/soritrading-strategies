/*
 * @coinsori-strategy v1
 * name: BTC BB Mean-Reversion Trend-Gated 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: in a confirmed uptrend (price above the 200-bar SMA ~ 33 days), sharp dips to
 * the lower Bollinger band usually snap back to the middle band. Buying dips in the direction of the
 * trend gives small frequent wins, while the trend filter keeps us out of bear markets entirely.
 * When it buys and sells: buys when the last closed price is below the lower Bollinger band (20,2)
 * while price is above the 200-bar SMA; sells when price closes back above the middle band, or
 * immediately if price drops 3 ATRs (min 5%) below our entry.
 * When it does NOT work: a slow bleed that stays above the 200-bar SMA (bull trap) — dips keep
 * getting deeper and the stop takes repeated small losses. Flat in strong bear markets (no loss,
 * but also no participation in the rebound).
 */
function onUpdate(ctx) {
  const BB_N = 20, BB_K = 2;
  const TREND_N = 200;   // ~33 days at 4h: bull regime filter (only buy dips in uptrends)
  const ATR_N = 14, ATR_MULT = 3, MIN_STOP = 0.05;  // stop = 3 ATR below entry, at least 5%

  const bb = ctx.bb(BB_N, BB_K, 1);       // closed-bar bands
  const trend = ctx.sma(TREND_N, 1);      // closed-bar trend filter
  if (bb == null || trend == null) { ctx.watch([]); return null; }

  const prevClose = ctx.closes.at(-2);    // last CLOSED bar (identical backtest/live)
  const price = ctx.price;
  const st = ctx.state;

  if (ctx.position > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : (st.entry || price);
    const atr = ctx.atr(ATR_N, 1);
    const stopDist = atr != null ? Math.max(atr * ATR_MULT, entry * MIN_STOP) : entry * MIN_STOP;
    const stopPx = entry - stopDist;
    if (price < stopPx) {
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR hard stop' }]);
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    if (prevClose > bb.mid) {
      ctx.watch([{ side: 'sell', price: bb.mid, trigger: 'above', note: 'back to mid band' }]);
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: bb.mid, trigger: 'above', note: 'back to mid band' }]);
    return null;
  }

  if (prevClose > trend && prevClose < bb.lower) {
    st.entry = price;
    ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'dip to lower band' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.98 };
  }
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'dip to lower band' }]);
  return null;
}
