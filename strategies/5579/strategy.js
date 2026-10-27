/*
 * @coinsori-strategy v1
 * name: BTC GoldenCross Vol-Sized 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated BTC 50/200 golden-cross trend signal is kept
 * untouched, but position size is now scaled inversely to volatility (ATR).
 * Bitcoin's daily volatility swings from ~1.5% to ~6%+; a fixed-size position
 * risks far more in high-vol periods. Sizing each trade to risk a fixed 3% of
 * equity at the 3xATR stop equalizes risk across regimes and should cut the
 * deep drawdowns the fixed-size version suffered.
 * When it buys and sells: Buys on the 50d EMA crossing above the 200d SMA
 * (closed bars) with price above the 200d SMA, sized so a 3xATR stop loses 3%
 * of equity. Sells on the death cross or when price closes below 3xATR below
 * the highest close since entry.
 * When it does NOT work: Same whipsaw risk as any trend follower in sideways
 * markets; and in very low-volatility regimes the position grows large, so a
 * sudden vol spike can still hit hard before the stop adjusts.
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
      ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'trail 3xATR' },
                 { side: 'sell', note: 'death cross' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const goldenCross = ema50Prev != null && sma200Prev != null && ema50Prev <= sma200Prev && ema50 > sma200;
  if (goldenCross && prevClose > sma200) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state = { hi: prevClose };
    // Vol-scaled size: risk 3% of equity at the 3xATR stop, in COINS.
    // Larger ATR -> smaller position; low vol -> bigger position.
    const riskPerCoin = 3 * atr;
    const qty = (ctx.cash * 0.03) / riskPerCoin;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'golden cross, vol-sized' }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
