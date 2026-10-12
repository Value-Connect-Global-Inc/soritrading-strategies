/*
 * @coinsori-strategy v1
 * name: SolOversoldReversion
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In an uptrend-biased market, sharp oversold dips tend to bounce back toward the mean — buying them with a tight stop captures the mean reversion while capping downside.
 * When it buys and sells: Buys when RSI(14) is oversold (<30) AND price is below the lower Bollinger band. Sells when price recovers to the mid band or RSI normalizes above 55, or a hard 2xATR stop is hit.
 * When it does NOT work: In prolonged bear markets the "dip" keeps dipping — the hard stop caps each loss but repeated stops bleed the account. Also during high-volatility capitulation events.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (px == null) return null;
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  if (rsi == null || bb == null || atr == null) return null;

  const pos = ctx.position || 0;

  // Hard stop on every position: 2x ATR below entry (1d bars can gap, so use 2x not 1x).
  if (pos > 0 && ctx.entryPx != null) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (px < stopPx) return { side: 'sell', qty: pos };
  }

  if (pos > 0) {
    // Exit when price recovers to the mid band or RSI normalizes — the bounce is done.
    if (px >= bb.mid || rsi >= 55) return { side: 'sell', qty: pos };
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'recovered to mid band' },
      { side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2xATR stop' }
    ]);
    return null;
  }

  // Entry: deep oversold below the lower band. Risk 1% of equity per trade so a stop-loss run cannot ruin the account.
  if (rsi < 30 && px < bb.lower) {
    const risk = 0.01 * ctx.cash;
    const stopDist = 2 * atr;
    const qty = risk / stopDist;
    if (qty <= 0) return null;
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'recovered to mid band' },
      { side: 'sell', price: px - 2 * atr, trigger: 'below', note: '2xATR stop' }
    ]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
