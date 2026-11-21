/*
 * @coinsori-strategy v1
 * name: ETH Fear&Greed Contrarian 4H
 * ex: binanceusdm
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed index is a sentiment oscillator
 * that mean-reverts: extreme fear marks panic that usually bounces, extreme
 * greed marks euphoria that usually fades. This trades AGAINST the crowd's
 * extreme mood instead of following price trend.
 * When it buys and sells: Buys when sentiment is fearful (<30) while price
 * still holds above its 200-bar trend (a panic dip inside an uptrend); sells
 * short when sentiment is greedy (>70) while price is below its 200-bar trend
 * (an euphoric rally inside a downtrend). Exits only when sentiment
 * normalizes (crosses 50) or on a 25% hard stop — the trend is an entry
 * filter only, so a mean-reversion trade gets room to play out.
 * When it does NOT work: in a relentless bull market that stays in greed for
 * months (no short entries, longs exit early on normalization and miss the
 * melt-up) and in a relentless bear that stays in fear (buying panic in a
 * downtrend gets stopped out). Choppy regimes churn both sides and pay
 * funding and fees.
 */
function onUpdate(ctx) {
  // Never re-fire an entry on the same bar index.
  if (ctx.state.lastEntryBar === ctx.i) { ctx.watch([]); return null; }

  const fg = ctx.data('main.fear_greed');   // 0-100 sentiment, updates daily
  const sma = ctx.sma(200, 1);              // long trend (closed bar)
  const atr = ctx.atr(14, 1);               // 4h volatility (closed bar)
  const price = ctx.price;
  if (fg == null || sma == null || atr == null || price == null || price <= 0) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;

  // Constant-risk sizing: risk a fixed fraction of equity per 4h bar.
  const RISK_BUDGET = 0.012; // 1.2% of equity at risk per bar (matches the proven trend rule)
  const atrPct = atr / price;
  let frac = atrPct > 0 ? RISK_BUDGET / atrPct : 0.5;
  if (frac > 0.98) frac = 0.98;
  if (frac < 0.05) frac = 0.05;

  // restart-surviving close of a position whose entry price is unknown
  if (pos !== 0 && ctx.entryPx == null) {
    const side = pos > 0 ? 'sell' : 'buy';
    const flag = 'restartClose_' + side;
    ctx.watch([{ side: side, price: price, trigger: pos > 0 ? 'below' : 'above', note: 'restart close' }]);
    if (ctx.state[flag]) return null;
    ctx.state[flag] = true;
    return { side: side, qty: Math.abs(pos), reduceOnly: true };
  }

  // while holding: exits only
  if (pos !== 0) {
    const side = pos > 0 ? 'sell' : 'buy';
    const entry = ctx.entryPx != null ? ctx.entryPx : price;
    const stopPx = pos > 0 ? entry * 0.75 : entry * 1.25; // hard stop at -25% either side
    // sentiment normalization exit: long exits when greed returns (>=55), short when fear returns (<=45)
    const sentExit = pos > 0 ? fg >= 55 : fg <= 45;
    ctx.watch([
      { side: side, price: stopPx, trigger: pos > 0 ? 'below' : 'above', note: 'hard stop 25%' },
      { side: side, price: pos > 0 ? 55 : 45, trigger: pos > 0 ? 'above' : 'below', note: 'sentiment normalize' }
    ]);
    if (sentExit || (pos > 0 ? price <= stopPx : price >= stopPx)) {
      return { side: side, qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }

  // no new entries while the allocator is not ready, or right after a forced close
  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }
  if (ctx.alloc && ctx.alloc.lastForced) { ctx.watch([]); return null; }

  // flat: contrarian entries with trend as an entry FILTER only
  // LONG: fearful (<30) but price above the 200-bar trend -> panic dip in uptrend
  const longSignal = fg < 30 && price > sma;
  // SHORT: greedy (>70) but price below the 200-bar trend -> euphoric rally in downtrend
  const shortSignal = fg > 70 && price < sma;
  const qty = (ctx.cash * frac) / price;
  if (qty <= 0) { ctx.watch([]); return null; }
  ctx.watch([
    { side: 'buy', price: sma, trigger: 'above', note: 'fear dip long', conds: [{ label: 'F&G<30', now: fg, op: '<', ref: 30, closed: true }] },
    { side: 'sell', price: sma, trigger: 'below', note: 'greed fade short', conds: [{ label: 'F&G>70', now: fg, op: '>', ref: 70, closed: true }] }
  ]);
  if (longSignal) { ctx.state.lastEntryBar = ctx.i; return { side: 'buy', qty }; }
  if (shortSignal) { ctx.state.lastEntryBar = ctx.i; return { side: 'sell', qty }; }
  return null;
}
