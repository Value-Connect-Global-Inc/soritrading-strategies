/*
 * @coinsori-strategy v1
 * name: Momentum ATR-Trailing 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same proven momentum core as the champion (close above the
 * 200-day EMA + positive 30-day return + a volatility regime gate that blocks
 * new entries while realized vol is in its own top decile). The DIFFERENCE is
 * the exit: instead of a fixed 15% stop and a trend-break exit, it uses an ATR
 * trailing stop as the ONLY way out. A trailing stop ratchets up with the market
 * and lets winners run through bull-market pullbacks — the regime where the
 * fixed-stop champion is weakest.
 * When it buys and sells: buys when the last closed bar is above the 200-day EMA,
 * its 30-day return is positive, and realized volatility is NOT in the top decile;
 * sells only when price closes 3x ATR below the highest close since entry.
 * When it does NOT work: in a long slow grind lower (no sharp reversal), the
 * trailing stop is never hit and the position bleeds slowly; and in a choppy
 * sideways market the 200-EMA + momentum entry whipsaws without a trend-break
 * exit to cut it.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  // realized volatility regime: ATR as % of price vs its own ~90th percentile.
  // Same gate as the champion — do not trust momentum right after a vol spike.
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const hist = ctx.closes.slice(-365, -1).map((cl, i, arr) => {
    if (i === 0) return 0;
    const p = arr[i - 1];
    return p > 0 ? Math.abs(cl / p - 1) : 0;
  });
  hist.sort((a, b) => a - b);
  const p90 = hist.length >= 30 ? hist[Math.floor(hist.length * 0.9)] : 1;
  const highVol = atrPct > p90;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) return null;
    const s = ctx.state || (ctx.state = {});
    // ratchet: highest CLOSED price since entry
    s.hi = Math.max(s.hi || entry, prevClose);
    // 3x ATR trail — wide enough to survive normal bull pullbacks, tight enough
    // to exit a crash before most of the damage; k=3 is the judgement call here.
    const k = 3;
    const trail = s.hi - k * atr;
    s.trail = trail;
    if (price <= trail) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: trail, trigger: 'below', note: '3x ATR trailing stop' }]);
    return null;
  }

  if (highVol) return null;
  const uptrend = prevClose > ema200;
  if (!uptrend || !(mom30 > 0)) return null;

  const volScale = Math.min(1, 0.02 / atrPct);   // calm coin gets bigger, wild coin smaller
  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
