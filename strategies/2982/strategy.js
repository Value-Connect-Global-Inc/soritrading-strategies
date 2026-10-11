/*
 * @coinsori-strategy v1
 * name: Multi-Asset Defensive Keltner MR Basket
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ATR-adaptive Keltner mean-reversion recipe is the most robust
 * cross-asset defensive edge in the ledger (validated on 12+ assets). Running the SAME
 * validated recipe on a basket of four large cryptos (BTC/ETH/SOL/XRP) lets the basket catch
 * a mean-reversion flush in WHICHEVER asset is dipping, instead of being stuck in one. Each
 * asset is traded independently at 25% of total equity, so the basket can hold several
 * positions at once and is never fully idle. This cycle I tried three "improvements" (hard
 * stop, upper-band take-profit, thesis-invalidation stop) — all were either inert or
 * actively harmful, because mean reversion must hold through the dip to pay off. The plain
 * EMA20/RSI60 exit remains the best.
 * When it buys and sells: For each asset, buy when price closes below the ATR-adaptive lower
 * Keltner band (EMA20 - 2.5x ATR) with RSI below 40, but ONLY while that asset's 200-day
 * average is rising (no falling knives). Size each buy at 25% of total equity. Sell when
 * price snaps back above the 20-day EMA or RSI climbs above 60.
 * When it does NOT work: In a broad crypto-wide bear where ALL four assets fall together,
 * the rising-200-day gate keeps us flat (capital-preserving but captures little). It lags a
 * relentless single-asset melt-up because it only buys pullbacks. The basket is defensive —
 * it protects capital and beats buy-and-hold in chop/bear, not in straight-line bulls.
 * 2025-01-01: added ctx.watch declarations — display only, trading logic unchanged.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (ema20 == null || atr == null || rsi == null || sma200 == null || sma200prev == null || atr <= 0) return null;

  const pos = ctx.position;
  const lowerBand = ema20 - 2.5 * atr;

  if (pos > 0) {
    // Snap-back exit above the 20-day EMA or once RSI turns up.
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back' },
      { side: 'sell', price: null, trigger: 'above', note: 'RSI > 60', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 60, closed: true }] }
    ]);
    if (price > ema20 || rsi > 60) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Only mean-revert inside a rising long-term trend — the gate that makes this family safe.
  const uptrend = sma200 > sma200prev;
  if (uptrend && price < lowerBand && rsi < 40) {
    // Size each position at 25% of total equity (4 assets -> 25% each).
    const equity = ctx.cash + ctx.uPnl;
    const targetValue = 0.25 * (Number.isFinite(equity) && equity > 0 ? equity : ctx.cash);
    const qty = targetValue / price;
    ctx.watch([
      { side: 'buy', price: lowerBand, trigger: 'below', note: 'Keltner lower band', conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'SMA200 rising', ok: uptrend }
      ] }
    ]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
