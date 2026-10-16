/*
 * @coinsori-strategy v1
 * name: BTC Turtle DXY-Gated 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto tends to rally when the US dollar weakens and
 * struggle when the dollar strengthens (inverse correlation). This takes the
 * proven turtle breakout engine and only allows long entries when the broad
 * trade-weighted dollar index has been FALLING over the last ~30 days — a
 * macro risk-on regime filter. The exit is unchanged from the proven engine.
 * When it buys and sells: buy when the last closed 4h bar exceeds the 55-bar
 * high, the 200-SMA is rising, AND the dollar index is lower than it was 180
 * bars (~30 days) ago. Sell when a closed bar falls below the 20-bar low, or
 * a 15% hard stop is hit.
 * When it does NOT work: it misses rallies that start while the dollar is
 * still rising (dollar turns down only after the move starts), and it has no
 * protection when crypto falls despite a weak dollar. The DXY series is daily
 * and business-days-only, so the gate updates slowly.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 260) return null;
  const prevClose = c.at(-2);
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);   // 200-SMA 20 bars earlier -> slope check

  // Donchian levels from CLOSED bars, EXCLUDING the signal bar itself
  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));   // 55 prior bars
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));   // 20 prior bars

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;   // hard stop 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l20) return { side: 'sell', qty: pos };   // 20-bar low breakdown
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' }]);
    return null;
  }

  // DXY regime gate: dollar must be weaker than ~30 days ago
  const dxy = ctx.data('dxy');
  if (dxy == null) return null;
  const st = ctx.state || {};
  if (!Array.isArray(st.dxyHist)) st.dxyHist = [];
  st.dxyHist.push(dxy);
  if (st.dxyHist.length > 181) st.dxyHist.shift();
  if (st.dxyHist.length < 181) return null;   // need a full 180-bar window (~30 days)
  const dxyPrev = st.dxyHist[0];
  const dxyFalling = dxy < dxyPrev;

  if (sma200 == null || sma200Prev == null) return null;
  if (!(prevClose > h55)) return null;                       // breakout
  if (!(sma200 > sma200Prev)) return null;                   // 200-SMA must be RISING
  if (!dxyFalling) return null;                              // macro regime must be risk-on

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true },
                       { label: 'DXY falling (30d)', ok: dxyFalling, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);   // 4h noise: target 1.5% ATR, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
