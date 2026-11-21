/*
 * @coinsori-strategy v1
 * name: BTC 1D USD Regime Long/Short (usdm)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin trades like a risk asset against the dollar —
 * when the broad US dollar strengthens, BTC tends to fall; when it weakens,
 * BTC tends to rise. We use the Fed broad dollar index (base_usd_broad) as a
 * regime gate on top of a BTC trend filter, and trade BOTH directions but
 * step aside when the dollar regime is neutral.
 * When it buys and sells: long when BTC closes above its 50-day EMA AND the
 * dollar is weak (z-score < 0); short when BTC closes below the EMA AND the
 * dollar is strong (z-score > 0); flat when the dollar regime is neutral.
 * Exits on an EMA reversal or a capped ATR trailing stop on each side.
 * When it does NOT work: in a crypto-only rally that ignores the dollar
 * (dollar flat while BTC pumps) the gate keeps it flat and it underperforms
 * holding; the 10-day data lag makes the dollar gate react late to a sudden
 * regime flip; shorting in a strong bull market adds funding cost.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const ema50_1 = ctx.ema(50, 1);
  const atr1 = ctx.atr(14, 1);
  const usd = ctx.data('base_usd_broad');
  if (price == null || ema50_1 == null || atr1 == null || atr1 <= 0 || usd == null) {
    ctx.watch([]);
    return null;
  }

  // Rolling USD index history for a z-score vs its own 200-day mean.
  const arr = ctx.state.usdArr || [];
  arr.push(usd);
  if (arr.length > 200) arr.shift();
  ctx.state.usdArr = arr;

  let usdZ = null;
  if (arr.length >= 60) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length);
    if (sd > 1e-9) usdZ = (usd - mean) / sd;
  }
  if (usdZ == null) {
    ctx.watch([]);
    return null;
  }

  const close1 = ctx.closes.at(-2);
  if (close1 == null) {
    ctx.watch([]);
    return null;
  }
  const pos = ctx.position;
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  const uptrend = close1 > ema50_1;
  const downtrend = close1 < ema50_1;

  // LONG position: trail a stop below the highest close since entry.
  if (pos > 0) {
    const highSince = ctx.state.highSince || close1;
    const newHigh = Math.max(highSince, close1);
    ctx.state.highSince = newHigh;
    // Cap the ATR stop at 20% below the high so a vol spike cannot widen it.
    const stop = Math.max(newHigh - 3 * atr1, newHigh * 0.80);
    const trendBroken = close1 < ema50_1;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'long stop' },
               { side: 'sell', price: ema50_1, trigger: 'below', note: 'EMA50 break' }]);
    if (close1 < stop || trendBroken) {
      ctx.state.highSince = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // SHORT position: trail a stop above the lowest close since entry.
  if (pos < 0) {
    const lowSince = ctx.state.lowSince || close1;
    const newLow = Math.min(lowSince, close1);
    ctx.state.lowSince = newLow;
    // Cap the ATR stop at 20% above the low.
    const stop = Math.min(newLow + 3 * atr1, newLow * 1.20);
    const trendBroken = close1 > ema50_1;
    ctx.watch([{ side: 'buy', price: stop, trigger: 'above', note: 'short stop' },
               { side: 'buy', price: ema50_1, trigger: 'above', note: 'EMA50 break' }]);
    if (close1 > stop || trendBroken) {
      ctx.state.lowSince = 0;
      return { side: 'buy', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }

  // FLAT: trend decides direction, dollar regime gates it. Symmetric sign
  // gate: long only on a weak dollar, short only on a strong dollar, flat
  // when neutral — so whipsaw regimes keep us out of the market.
  const dollarWeak = usdZ < 0;     // dollar below its own mean -> allow long
  const dollarStrong = usdZ > 0;   // dollar above its own mean -> allow short
  const longSignal = allocOk && uptrend && dollarWeak;
  const shortSignal = allocOk && downtrend && dollarStrong;
  ctx.watch([{ side: 'buy', price: ema50_1, trigger: 'above', note: 'long entry', conds: [{ label: 'USD z', now: usdZ, op: '<', ref: 0 }, { label: 'close > EMA50', ok: uptrend }] },
             { side: 'sell', price: ema50_1, trigger: 'below', note: 'short entry', conds: [{ label: 'USD z', now: usdZ, op: '>', ref: 0 }, { label: 'close < EMA50', ok: downtrend }] }]);
  if (longSignal) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  if (shortSignal) {
    ctx.state.lowSince = close1;
    return { side: 'sell', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
