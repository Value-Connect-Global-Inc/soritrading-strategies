/*
 * @coinsori-strategy v1
 * name: BTC GoldenCross Baseline 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: exact copy of the champion #5574 used as a baseline on the
 * same windows as the VIX-latch variant, to attribute any difference to the VIX
 * filter alone. No VIX data is used here.
 * When it buys and sells: same golden-cross entry, death-cross / 3xATR-trail exits.
 * When it does NOT work: same as any trend follower (whipsaw in chop, lag buy-and-hold).
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 210) return null;

  const pos = ctx.position;
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || sma200 == null || atr == null || atr <= 0) return null;

  const prevClose = closes.at(-2);
  const ema50Prev = ctx.ema(50, 2);
  const sma200Prev = ctx.sma(200, 2);

  if (pos != null && pos > 0) {
    let st = ctx.state || {};
    if (typeof st.hi !== 'number') st.hi = prevClose;
    if (prevClose > st.hi) st.hi = prevClose;
    ctx.state = st;
    const trailStop = st.hi - 3 * atr;
    const deathCross = ema50Prev != null && sma200Prev != null && ema50Prev > sma200Prev && ema50 <= sma200;
    if (deathCross || prevClose < trailStop) {
      ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'trail stop 3xATR' },
                 { side: 'sell', note: 'death cross' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const goldenCross = ema50Prev != null && sma200Prev != null && ema50Prev <= sma200Prev && ema50 > sma200;
  if (goldenCross && prevClose > sma200) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state = { hi: prevClose };
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'golden cross above 200d' }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
