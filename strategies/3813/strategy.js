/*
 * @coinsori-strategy v1
 * name: BtcDonchianTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sustained Bitcoin trends are best caught with breakouts. A close above
 * the 20-day high signals a new up-leg and a 4x ATR trailing stop exits only when the
 * trend actually turns — no tight stop to be shaken out. Position size is scaled by ATR
 * so a big daily move risks only ~3% of the account.
 * When it buys and sells: Buys when the daily close is above the highest close of the
 * last 20 days (and price is above its 200-day average to avoid bear-market rallies).
 * Sells when price falls 4x ATR below the highest close since entry (trailing stop).
 * When it does NOT work: in a long sideways range the breakout fires and immediately
 * fails (small repeated losses). In a slow grind down it waits for the 200MA filter
 * and can sit in cash while shorts would profit. Long-only, so it never profits from
 * bear markets.
 */

function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || sma200 == null) return null;

  const closes = ctx.closes;
  const price = ctx.price;
  const pos = ctx.position || 0;

  // highest 20 closes, all closed bars (ago>=1 = closed)
  let hi20 = -Infinity;
  for (let i = 2; i <= 21; i++) {
    const c = closes.at(-i);
    if (c == null) return null;
    if (c > hi20) hi20 = c;
  }

  // highest close since entry (trailing reference), kept in persistent state
  const hiSinceEntry = ctx.state.hiSinceEntry != null ? ctx.state.hiSinceEntry : price;
  if (pos > 0) {
    if (price > hiSinceEntry) ctx.state.hiSinceEntry = price;
  } else {
    ctx.state.hiSinceEntry = null;
  }
  const trailStop = ctx.state.hiSinceEntry != null ? ctx.state.hiSinceEntry - 4 * atr : null;

  // volatility-scaled size: 3% of account risk per 4x ATR (the actual stop distance)
  const riskPerUnit = 4 * atr;
  const qty = (ctx.cash * 0.03) / riskPerUnit;

  ctx.watch([
    { side:'buy', price: hi20, trigger:'above', note:'20d high breakout',
      conds:[{ label:'price > SMA200', ok: price > sma200 }] },
    { side:'sell', price: trailStop, trigger:'below', note:'ATR trailing stop' }
  ]);

  if (pos === 0) {
    if (price > hi20 && price > sma200) {
      ctx.state.hiSinceEntry = price;
      return { side:'buy', qty: qty };
    }
    return null;
  }

  if (trailStop != null && price <= trailStop) return { side:'sell', qty: pos };
  return null;
}
