/*
 * @coinsori-strategy v1
 * name: FearGreed Regime + Donchian BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: two independently validated edges combined into one.
 * The Fear & Greed sentiment regime (buy greed, exit fear) held up on every
 * asset tested; the VolTarget Donchian trend is a solid defensive trend
 * follower. The regret of the trend follower was lags in bulls — the sentiment
 * regime adds a second, independent confirmation so we only enter when BOTH
 * the price trend AND the crowd mood agree.
 * When it buys and sells: buys when price breaks the 55-day high AND
 * Fear & Greed >= 55 (sentiment confirms the breakout); exits on the 20-day
 * low break, a 2xATR stop, or F&G dropping to <= 40. Size = min(1, 2%/ATR%).
 * When it does NOT work: in a sideways range the double condition still
 * whipsaws; if sentiment lags the price action (common at tops) it enters
 * late. It under-captures straight-line bulls because vol-targeting caps
 * exposure and the F&G condition adds another entry delay.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const hh = ctx.high(55, 1);
  const ll = ctx.low(20, 1);
  if (atr == null || hh == null || ll == null) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null; // F&G starts Feb 2018; unknown = do not trade

  const pos = ctx.position;
  const atrPct = atr / price;
  const size = Math.min(1, 0.02 / atrPct); // 2% daily vol target (see #4563)
  const equity = ctx.cash + pos * price;
  const targetQty = (equity * size * 0.95) / price;

  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      const stopPx = entry - 2 * atr;
      if (price <= stopPx) return { side: 'sell', qty: pos };
      if (price < ll) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: 2xATR' },
                 { side: 'sell', price: ll, trigger: 'below', note: 'exit: 20d low' }]);
    } else {
      if (price < ll) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: ll, trigger: 'below', note: 'exit: 20d low' }]);
    }
    // Sentiment confirmation for exit: leave when the crowd turns fearful even
    // before the price structure breaks.
    if (fg <= 40) return { side: 'sell', qty: pos };
    const diff = targetQty - pos;
    if (Math.abs(diff) / Math.max(pos, 1e-9) > 0.15) {
      return { side: diff > 0 ? 'buy' : 'sell', qty: Math.abs(diff) };
    }
    return null;
  }

  // Only buy when BOTH the price breaks out AND the crowd is greedy (>=55).
  if (price > hh && fg >= 55 && targetQty > 0) {
    ctx.watch([{ side: 'buy', price: hh, trigger: 'above', note: 'enter: 55d high + F&G>=55' }]);
    return { side: 'buy', qty: targetQty };
  }
  ctx.watch([{ side: 'buy', price: hh, trigger: 'above', note: 'enter: 55d high + F&G>=55' }]);
  return null;
}
