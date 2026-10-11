/*
 * @coinsori-strategy v1
 * name: DOGE 1D ATR-Adaptive Keltner MR (Full-Cash)
 * ex: binance
 * syms: DOGEUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ATR-adaptive Keltner mean-reversion recipe is the one
 * robust edge in this ledger — positive on nearly every window across 9+ assets.
 * This DOGE 1D version keeps the exact proven entry/exit but sizes each entry with
 * nearly full cash. The ledger showed the previous 1.5%-risk-per-trade ATR sizing
 * starved the returns (cut a +254% window to +13%) while only trimming MDD from
 * 13% to 2% — a terrible trade-off for a strategy whose entries are rare.
 * When it buys and sells: Buys an oversold flush below the ATR-adaptive lower Keltner
 * band (EMA20 - 2.5x ATR) with RSI<40 inside a rising 200-day uptrend, using nearly
 * full cash. Sells on snap-back above the mid band (EMA20) or RSI above 60.
 * When it does NOT work: In a broad bear DOGE falls hardest and the 200-day gate keeps
 * it out of most trades (capital-preserving but captures little). It lags buy-and-hold
 * in a relentless meme melt-up because it sits in cash waiting for a pullback. MDD is
 * low (single digits to ~13%) but a meme asset can still gap; this is not a melt-up
 * capture machine.
 *
 * 2025-01-16: Added ctx.watch declarations — display only, trading logic unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (ema20 == null || atr == null || rsi == null || sma200 == null || sma200prev == null) return null;

  const lowerBand = ema20 - 2.5 * atr;
  const uptrend = sma200 > sma200prev;

  if (pos > 0) {
    // Display what we're waiting for to exit the position
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 mid-band touch', conds: [
        { label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }
      ]},
      { side: 'sell', price: 60, trigger: 'above', note: 'RSI(14) > 60', conds: [
        { label: 'Price vs EMA20', now: price, op: '>', ref: ema20, closed: true }
      ]}
    ]);
    if (price > ema20 || rsi > 60) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }
  // Display what we're waiting for to enter
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'Lower Keltner touch', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'SMA200 rising', ok: uptrend }
    ]}
  ]);
  if (uptrend && price < lowerBand && rsi < 40) {
    // Full-cash sizing: entries are rare (only deep oversold flushes in an uptrend),
    // and the full-cash version already holds MDD to ~13%. A small 0.95 cap leaves
    // room for fees/slippage. Risk-sizing was proven to starve returns (see note).
    const qty = (ctx.cash / price) * 0.95;
    return { side: 'buy', qty: qty };
  }
  return null;
}
