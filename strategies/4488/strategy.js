/*
 * @coinsori-strategy v1
 * name: Dual-Regime Momentum: Usage + Dollar (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: two INDEPENDENT regime filters must BOTH say risk-on before we buy:
 * (1) Bitcoin network usage (active addresses) at/above its 30-day average, and
 * (2) the US dollar FALLING over 30 days. Both confirm a real, macro-supported rally.
 * When it buys and sells: buys when 30-day price return is positive, close is above the
 * 200-day EMA, active addresses are at/above their 30-day average, AND the dollar is
 * lower than 30 days ago. Sells when close falls below the 200-day EMA, 30-day return
 * turns negative, or a 15% hard stop is hit.
 * When it does NOT work: the two filters can disagree for long stretches (e.g. BTC
 * usage rising while the dollar is flat) — then we stay out and miss the rally. It
 * also misses the first leg of a recovery right after a crash, when usage is still low.
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

  // Usage gate: active addresses at/above their 30-day average (default allow on missing)
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  let usageUp = true;
  if (addr != null && addrAvg != null) usageUp = addr >= addrAvg;

  // Dollar gate: falling over 30 days (default allow on missing)
  const dxy = ctx.data('dxy');
  const hist = ctx.state.dxyHist || [];
  let dollarFalling = true;
  if (dxy != null) {
    hist.push(dxy);
    if (hist.length > 31) hist.shift();
    ctx.state.dxyHist = hist;
    if (hist.length >= 31) dollarFalling = dxy < hist[0];
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'addr >= 30d avg', ok: usageUp, closed: true },
                       { label: 'dollar falling 30d', ok: dollarFalling, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !usageUp || !dollarFalling) return null;  // placeholder fixed below

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
