/*
 * @coinsori-strategy v1
 * name: BTC 1D Macro Dollar-Regime Trend
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A genuinely different signal family from the price-based champion.
 * It uses the US Dollar Index (DXY) as a macro risk-on/risk-off regime filter: a falling
 * dollar is historically supportive for risk assets (crypto), a rising dollar is a
 * headwind. We only hold BTC long when the dollar is in a downtrend AND price is above
 * its 200-day average — two independent confirmations (macro + trend).
 * When it buys and sells: Buy when price is above the 200-day average AND the dollar is
 * falling (DXY below its own slow average). Sell when price closes below the 200-day
 * average OR the dollar turns up.
 * When it does NOT work: If DXY macro data is unavailable this strategy sits flat. It
 * misses BTC rallies that happen during dollar strength, and the macro gate is laggy
 * (DXY moves slowly), so it may stay out at the start of a rally.
 *
 * Display-only change: added ctx.watch declarations (no trading logic changed).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma200 == null || sma200prev == null) return null;

  // Read the US Dollar Index macro series (returns null if unavailable).
  const dxy = ctx.macro('dxy');
  if (dxy == null) return null;
  const dxyVal = (typeof dxy === 'object') ? (dxy.value != null ? dxy.value : dxy.close) : dxy;
  if (!Number.isFinite(dxyVal) || dxyVal <= 0) return null;

  // Dollar trend via a slow EMA (falling dollar = risk-on).
  const prev = ctx.state.dxyEma;
  const ema = (prev != null) ? prev * 0.95 + dxyVal * 0.05 : dxyVal;
  ctx.state.dxyEma = ema;
  const dollarFalling = dxyVal < ema;

  const pos = ctx.position;
  if (pos > 0) {
    if (price < sma200 || sma200 < sma200prev || !dollarFalling) {
      ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', qty: pos, note: 'exit: close below SMA200' }]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', qty: pos, note: 'exit: close below SMA200' }]);
    return null;
  }

  if (price > sma200 && sma200 > sma200prev && dollarFalling) {
    const qty = (ctx.cash / price) * 0.98;
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', qty: qty, note: 'entry: uptrend + dollar falling' }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
