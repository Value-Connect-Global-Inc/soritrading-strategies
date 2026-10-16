/*
 * @coinsori-strategy v1
 * name: Momentum Chandelier-Exit 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same proven momentum core as the champion (close above the
 * 200-day EMA + positive 30-day return + volatility regime gate that blocks new
 * entries while realized vol is in its own top decile). The DIFFERENCE is the
 * hard stop: instead of a fixed 15% below entry, it uses a chandelier exit that
 * ratchets up with the market — the highest close of the last 22 bars minus
 * 3x ATR. In a strong uptrend the stop rises with price, so winners are never
 * capped at 15%; in a crash the stop is already high and exits early. The
 * champion's trend-break and momentum-fade exits are KEPT (a trailing-only
 * variant without them was catastrophic).
 * When it buys and sells: buys when the last closed bar is above the 200-day EMA,
 * its 30-day return is positive, and realized volatility is NOT in the top decile;
 * sells when price closes below the chandelier stop, below the 200-day EMA, or
 * when the 30-day return turns negative.
 * When it does NOT work: in a choppy sideways market the 200-EMA + momentum entry
 * whipsaws and the chandelier stop is hit often; and in a slow grind lower the
 * stop ratchets down too slowly and gives back more than a fixed stop would.
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
    // chandelier exit: highest CLOSED price of the last 22 bars minus 3x ATR.
    // 22 bars ~ one month of highs; k=3 so normal pullbacks don't trigger it.
    const lookback = 22;
    let hi = prevClose;
    const len = c.length;
    for (let i = 2; i <= lookback + 1 && i < len; i++) {
      const v = c.at(-i);
      if (v > hi) hi = v;
    }
    const stop = hi - 3 * atr;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'chandelier stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
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
