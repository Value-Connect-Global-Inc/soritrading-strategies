/*
 * @coinsori-strategy v1
 * name: ETH Trend Long/Short 4H
 * ex: binanceusdm
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The ETH 4h trend rule that already halved drawdown vs
 * buy-and-hold in every window (spot version) is extended to trade BOTH
 * directions on perpetual futures. In the 2022-24 and 2024-26 windows ETH
 * fell about 30%; the spot version only sat those out, a long/short version
 * can earn them. Same slow 200-bar trend, same constant-risk sizing.
 * When it buys and sells: Long when price is above a RISING 200-bar average;
 * short only when BOTH the 50-bar and 200-bar averages are falling (short
 * term and long term agree — crypto bear rallies are violent, so the short
 * side demands more confirmation than the long side). Exits on the opposite
 * rollover or a 30% hard stop. Position size shrinks as ETH's own vol rises.
 * When it does NOT work: choppy sideways regimes churn both sides and pay
 * fees and funding; a violent rally that reverses quickly whipsaws the short
 * side. The slow trend enters late into fast reversals.
 */
function onUpdate(ctx) {
  // Detect a restart: if the bar time goes backward, skip the first bar so we
  // never fire an entry straight into a freshly-restarted, possibly-flat run.
  const t = ctx.times && ctx.times.length ? ctx.times.at(-1) : null;
  if (t != null && ctx.state.lastT !== undefined && t < ctx.state.lastT) {
    ctx.state.lastT = t;
    ctx.watch([]);
    return null;
  }
  if (t != null) ctx.state.lastT = t;

  const sma = ctx.sma(200, 1);      // long trend line (closed bar)
  const smaOld = ctx.sma(200, 30);  // long trend line 30 bars ago, for slope
  const sma50 = ctx.sma(50, 1);     // short trend line (closed bar)
  const sma50Old = ctx.sma(50, 30); // short trend line 30 bars ago, for slope
  const atr = ctx.atr(14, 1);       // 4h volatility (closed bar)
  if (sma == null || smaOld == null || sma50 == null || sma50Old == null || atr == null) { ctx.watch([]); return null; }

  const price = ctx.price;
  if (price == null || price <= 0) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;
  const rising = sma > smaOld;
  const falling = sma < smaOld;
  const rising50 = sma50 > sma50Old;
  const falling50 = sma50 < sma50Old;

  // Constant-risk sizing: risk a fixed fraction of equity per 4h bar.
  const RISK_BUDGET = 0.012; // 1.2% of equity at risk per bar (same as spot version)
  const atrPct = atr / price;
  let frac = atrPct > 0 ? RISK_BUDGET / atrPct : 0.5;
  if (frac > 0.98) frac = 0.98;   // cap: never more than ~all-in
  if (frac < 0.05) frac = 0.05;   // floor: never vanish in extreme vol

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
    const stopPx = pos > 0 ? entry * 0.70 : entry * 1.30; // hard stop at -30% either side
    const rollExit = pos > 0 ? (price < sma && falling) : (price > sma && rising);
    ctx.watch([
      { side: side, price: sma, trigger: pos > 0 ? 'below' : 'above', note: 'trend rollover exit' },
      { side: side, price: stopPx, trigger: pos > 0 ? 'below' : 'above', note: 'hard stop 30%' }
    ]);
    if (rollExit || (pos > 0 ? price <= stopPx : price >= stopPx)) {
      return { side: side, qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }

  // no new entries while the allocator is not ready, or right after a forced close
  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }
  if (ctx.alloc && ctx.alloc.lastForced) { ctx.watch([]); return null; } // wait a bar after platform closed us

  // flat: enter long on confirmed uptrend, short only when BOTH timeframes fall
  const longSignal = price > sma && rising;
  const shortSignal = price < sma && falling && price < sma50 && falling50;
  const qty = (ctx.cash * frac) / price;
  if (qty <= 0) { ctx.watch([]); return null; }
  ctx.watch([
    { side: 'buy', price: sma, trigger: 'above', note: 'uptrend long entry', conds: [{ label: 'SMA200 rising', ok: rising, closed: true }] },
    { side: 'sell', price: sma, trigger: 'below', note: 'downtrend short entry', conds: [{ label: 'SMA200 falling', ok: falling, closed: true }, { label: 'SMA50 falling', ok: falling50, closed: true }] }
  ]);
  if (longSignal) return { side: 'buy', qty };
  if (shortSignal) return { side: 'sell', qty };
  return null;
}
