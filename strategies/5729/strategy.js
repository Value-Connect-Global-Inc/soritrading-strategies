/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + VIX Risk Gate 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion (SMA200 + vol-target) rides down through crashes
 * to a ~50% drawdown because it only exits on the slow 200-day average. Equity
 * market fear (VIX) and crypto drawdowns often rise together — when VIX is in a
 * panic regime, risk assets including BTC tend to fall. This variant adds a slow
 * macro risk gate: stay in cash while VIX is high, so a crash is avoided BEFORE
 * the 200-day exit fires. The slow exit itself is untouched.
 * When it buys and sells: Buys when the previous close is above SMA200 AND VIX is
 * calm (below 25), sized by vol-target. While holding, exits if close falls below
 * SMA200 OR VIX rises above 30 (panic). Re-enters only when VIX calms back below
 * 25 — the 25/30 band avoids flip-flopping on a single threshold.
 * When it does NOT work: Crypto-only crashes that happen while equity fear is low
 * (e.g. 2018's long grind) are not caught — VIX never spiked then. It can exit on
 * a VIX spike and miss a fast V-recovery. It is a slow gate, so it cannot help a
 * sudden crypto-specific collapse.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr20 = ctx.atr(20, 1);
  const vix = ctx.data("base_vix"); // CBOE VIX, lagged 2d, no look-ahead
  if (sma200 == null || atr20 == null || vix == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  // hysteresis band: enter only when calm (VIX<25), exit when panicking (VIX>=30)
  const riskOn = vix < 25;
  const riskOff = vix >= 30;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200', conds: [{ label: 'VIX calm', ok: riskOn }] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' }
  ]);

  if (pos > 0) {
    if (prevClose < sma200 || riskOff) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > sma200 && riskOn) {
    // same vol-target sizing as the champion
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
