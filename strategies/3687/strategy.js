/*
 * @coinsori-strategy v1
 * name: FearGreedRecovery
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: buying WHILE fear is extreme buys a falling knife. The
 * edge is in the RECOVERY: after a fear episode (FG<30), when the Fear & Greed
 * index turns back up through 45 while price is still above its 200-day
 * average, capitulation has ended and the uptrend can resume.
 * When it buys and sells: buy when FG crosses above 45, was below 30 within
 * the last 15 days, and price is above its 200-day average; sell when FG
 * crosses above 80 (euphoria), price falls below the 200-day average, or a
 * 2x ATR stop is hit.
 * When it does NOT work: in a bear market price stays below the 200-day
 * average so it never buys (safe but flat); a recovery can fail and roll
 * straight back into fear, so the hard stop is essential. If the sentiment
 * feed is late or missing it cannot trade.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const fg = ctx.data('fear_greed');
  if (sma200 == null || atr == null || atr <= 0 || fg == null) return null;

  const st = ctx.state;
  const prevFg = st.prevFg;
  st.prevFg = fg;
  if (fg < 30) st.fearBar = ctx.i; // remember when a fear episode last happened
  const recentFear = (st.fearBar != null) && (ctx.i - st.fearBar) <= 15;
  const crossedUp = prevFg != null && prevFg <= 45 && fg > 45;

  const pos = ctx.pos(ctx.sym);
  const qty = (ctx.cash / price) * 0.7;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || price < sma200 || fg > 80) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'uptrend broke',
                 conds: [{ label: 'Fear&Greed', now: fg, op: '>', ref: 80, closed: true }] }]);
    return null;
  }

  if (crossedUp && recentFear && price > sma200) {
    ctx.watch([]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'FG recovery entry',
               conds: [{ label: 'FG>45 recovery', ok: crossedUp }, { label: 'fear<30 <15d', ok: recentFear },
                       { label: 'Fear&Greed', now: fg, op: '>', ref: 45, closed: true }] }]);
  return null;
}
