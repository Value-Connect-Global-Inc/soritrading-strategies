/*
 * @coinsori-strategy v1
 * name: BTC RSI Dip-Buy Mean Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: mean reversion — the opposite family of the OBV trend
 * champion. In a confirmed uptrend, sharp oversold dips (RSI < 30) tend to
 * revert back up; buying the dip in an uptrend bets on that reversion instead
 * of chasing strength.
 * When it buys and sells: buys when RSI(14) on the closed bar is below 30 AND
 * price is still above its 200-day average (an uptrend dip, not a falling
 * knife). Sells when the dip has fully recovered (RSI > 70), when price breaks
 * back under the 200-day average, or on a -20% hard stop.
 * When it does NOT work: in a choppy sideways range RSI dips below 30 without a
 * real recovery (whipsaw); and if a real bear market begins, the 200-day gate
 * keeps it flat so it misses the bottom entirely. Few trades by design.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const pos = ctx.position;

  const rsi = ctx.rsi(14, 1);
  if (rsi == null) return null;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry * 0.8 : null;
    const w = [
      { side:'sell', price: sma200, trigger:'below', note:'trend break' },
      { side:'sell', price: null, note:'', conds:[{ label:'RSI>70 recovered', now:rsi, op:'>', ref:70, closed:true }] }
    ];
    if (stopPx != null) w.unshift({ side:'sell', price: stopPx, trigger:'below', note:'hard stop -20%' });
    ctx.watch(w);

    // Hard stop first: cap a failed dip at -20%.
    if (entry != null && price <= entry * 0.8) {
      ctx.state.cd = 5;
      return { side:'sell', qty:pos, reduceOnly:true };
    }
    // Dip recovered: RSI back above 70, or trend broke.
    if ((rsi > 70 && cd === 0) || (price < sma200 && cd === 0)) {
      ctx.state.cd = 5;
      return { side:'sell', qty:pos, reduceOnly:true };
    }
    return null;
  }

  ctx.watch([
    { side:'buy', price: sma200, trigger:'above', note:'uptrend gate',
      conds:[{ label:'RSI<30 oversold', now:rsi, op:'<', ref:30, closed:true }] }
  ]);

  // Dip-buy: oversold inside an uptrend.
  if (rsi < 30 && price > sma200 && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    return { side:'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
