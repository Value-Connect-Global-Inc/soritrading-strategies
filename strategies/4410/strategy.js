/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index is a sentiment gauge built from
 * volatility, momentum and social data. Historically extreme fear (index <= 20) marks
 * panic selling near bottoms and extreme greed (>= 70) marks euphoric tops. This
 * strategy buys the panic and sells the euphoria — the opposite of trend-following,
 * a different family from the DXY macro filter (pure sentiment mean-reversion).
 * When it buys and sells: buys when the Fear & Greed index plunges to 20 or below
 * (a fresh entry into extreme fear) AND price is above its 200-day EMA (uptrend).
 * Sells when it climbs back to 70 (greed) or when a 2x ATR hard stop is hit.
 * When it does NOT work: in a long grinding bear market (2018, 2022) the index sits
 * in fear for months while price keeps falling — the trend guard keeps it in cash,
 * so it misses the eventual bottom. It also misses entire bear-to-bull reversals.
 * Contrarian buying in a structural bear can catch falling knives.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema200 = ctx.ema(200, 1);
  if (atr == null || atr <= 0 || ema200 == null) return null;

  // Accumulate daily Fear & Greed values (0-100) into a rolling history
  const st = ctx.state;
  if (st.fgHist == null) st.fgHist = [];
  const fgRaw = ctx.data('fear_greed');
  const fg = fgRaw == null ? null : Number(fgRaw);
  if (fg != null && Number.isFinite(fg) && fg >= 0) st.fgHist.push(fg);
  if (st.fgHist.length > 20) st.fgHist.shift();
  if (st.fgHist.length < 3) return null;
  const fgNow = st.fgHist[st.fgHist.length - 1];
  const fgPrev = st.fgHist[st.fgHist.length - 2];
  const fgPrev2 = st.fgHist[st.fgHist.length - 3];

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2 * atr;   // hard stop: 2x daily ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (fgNow != null && fgNow >= 70) return { side: 'sell', qty: pos }; // sell the euphoria
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', note: 'sell when F&G >= 70',
                 conds: [{ label: 'F&G now', now: fgNow, op: '>=', ref: 70, closed: false }] }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend = prevClose > ema200;   // trend guard: only buy fear in an uptrend
  // Buy only on a FRESH plunge into extreme fear (previous day > 20, now <= 20)
  const freshFear = fgPrev != null && fgPrev <= 20 && (fgPrev2 == null || fgPrev2 > 20);
  ctx.watch([{ side: 'buy', note: 'buy at extreme fear',
               conds: [{ label: 'F&G prev day', now: fgPrev, op: '<=', ref: 20, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'fresh fear cross', ok: freshFear, closed: true }] }]);
  if (!freshFear || !uptrend) return null;

  const riskCash = ctx.cash * 0.02;        // risk 2% of cash per trade
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
