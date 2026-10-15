/*
 * @coinsori-strategy v1
 * name: Dollar-Trend Gated Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin behaves like a risk asset — its biggest rallies (2020H2,
 * 2023) happened while the US dollar was FALLING, and its worst crashes (2018, 2022)
 * happened while the dollar was RISING. We only buy momentum while the dollar is in a
 * 30-day downtrend, so we skip the phases where a strong dollar squeezes risk assets.
 * When it buys and sells: buys when 30-day return is positive, close is above the
 * 200-day EMA, and the dollar is lower than it was 30 days ago. Sells when close
 * falls below the 200-day EMA, 30-day return turns negative, or a 15% hard stop.
 * When it does NOT work: the dollar is a slow macro signal — it lags a sudden
 * risk-off crash by weeks, and BTC can still rally while the dollar is flat or
 * mildly rising (2019, 2021), which this filter will miss.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;          // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  // Dollar-trend gate: only buy when the dollar is lower than 30 days ago
  // (falling dollar = risk-on regime). Missing data defaults to allowing.
  const dxy = ctx.data('dxy');
  const hist = ctx.state.dxyHist || [];
  let dollarFalling = true;
  if (dxy != null) {
    hist.push(dxy);
    if (hist.length > 31) hist.shift();
    ctx.state.dxyHist = hist;
    if (hist.length >= 31) {
      dollarFalling = dxy < hist[0];   // current dxy < dxy from 30 bars ago
    }
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'dollar falling 30d', ok: dollarFalling, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !dollarFalling) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
