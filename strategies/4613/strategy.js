/*
 * @coinsori-strategy v1
 * name: Macro DXY Regime Basket 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: crypto has historically been a "risk-on" asset that tends
 * to rise while the US dollar is weakening and stall while the dollar is
 * strengthening. This bets on that macro regime instead of on price patterns:
 * it is long the basket only while the Fed's broad trade-weighted dollar index
 * (DXY) is below its 90-day average, and flat while the dollar is strong.
 * When it buys and sells: buy each asset when the dollar index falls below its
 * 90-day average (weak-dollar regime), sell when the dollar climbs back above
 * that average or the 2.5-ATR hard stop is hit. 24-bar cooldown after an exit.
 * When it does NOT work: the dollar/crypto link is noisy and can break for
 * months (crypto has rallied during dollar strength on its own drivers). In a
 * flat-dollar regime the strategy flips on and off and churns fees; it is also
 * flat (no loss but no gain) through long dollar-strength periods even when
 * crypto is rallying on its own.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const st = ctx.state || {};
  if (!st.dxyHist) st.dxyHist = []; // rolling history of the dollar index, one entry per bar

  const v = ctx.data('dxy');
  if (v == null) return null; // no dollar data -> stand aside rather than guess
  st.dxyHist.push(v);
  const hist = st.dxyHist;
  if (hist.length > 600) hist.shift();
  // Need ~90 days of history before judging the regime (6 bars/day on 4h).
  if (hist.length < 540) return null;

  // 90-day average of the dollar index over the last 540 bars.
  let sum = 0;
  for (let k = hist.length - 540; k < hist.length; k++) sum += hist[k];
  const dxySma = sum / 540;
  const dollarWeak = v < dxySma;

  const sym = ctx.sym;
  if (!st.cool) st.cool = {}; // per-symbol cooldown bar index after an exit
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    // Exit on regime flip or the hard stop; the stop protects the account when
    // a crash happens while the dollar is still weak.
    const stopPx = entry != null ? entry - 2.5 * atr : price - 2.5 * atr;
    if (!dollarWeak || price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 2.5 ATR' }]);
    return null;
  }

  // Cooldown: wait 24 bars after an exit so a stopped trade is not re-entered
  // into the same falling market.
  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 24) return null;
  if (!dollarWeak) return null;

  // Size: risk a small fixed share of the per-symbol cash on the stop distance,
  // the same risk budget as the champion trend basket.
  const riskCash = ctx.cash * 0.01;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
