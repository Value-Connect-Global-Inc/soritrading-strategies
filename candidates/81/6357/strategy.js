/*
 * @coinsori-strategy v1
 * name: BTC Vol-Targeted Trend Rider 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following on BTC 4h works, but its drawdowns come from riding big moves at full size into a volatility explosion. Instead of filtering entries with a gate (which misses rallies), this strategy always participates in the 300-bar uptrend but sizes the position by current volatility: calm (low ATR) = near full size, volatile = smaller size. Same risk per ATR unit regardless of regime, plus a hard stop-loss the plain rider does not have.
 * When it buys and sells: buys when the previous bar closes above the 300-bar average AND volatility is calm (ATR below 1.2x its 60-bar median); position size is capped so each trade risks ~1.5% of equity per 1 ATR of movement. Sells when price closes below the 300-bar average, when ATR exceeds 2.2x its median (blowup), or when price falls 10% below entry (hard stop).
 * When it does NOT work: in a sustained high-volatility bull ATR stays elevated, the calm filter keeps it flat and it misses the rally. In long sideways chop the trend filter whipsaws and the small per-trade size means many small losses. A sudden gap through the stop still loses the gap amount.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma300 = ctx.sma(300, 1);
  if (sma300 == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // Rolling ATR history -> median (robust to a few huge bars).
  const hist = ctx.state.atrHist || [];
  hist.push(atr);
  if (hist.length > 120) hist.shift();
  ctx.state.atrHist = hist;
  if (hist.length < 60) { ctx.watch([]); return null; }
  const sorted = [...hist].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const calm = atr < median * 1.2;   // enter only when vol is near its recent normal
  const blowup = atr > median * 2.2; // vol explosion -> step out before the break

  // Vol-targeted sizing: risk ~1.5% of equity per 1 ATR of movement.
  // ATR as % of price tells us how far a 1-ATR move is; size inversely so each trade
  // carries the same risk. Cap between 5% and 98% of cash.
  const atrPct = atr / ctx.price;
  const targetFrac = 0.015 / atrPct;
  const frac = Math.min(0.98, Math.max(0.05, targetFrac));

  const enterLvl = sma300 * 1.01;
  const exitLvl = sma300 * 0.99;

  if (ctx.position <= 0) {
    ctx.watch([{
      side: 'buy', price: enterLvl, trigger: 'above', note: 'above SMA300',
      conds: [{ label: 'ATR calm', ok: calm }]
    }]);
    if (prevClose > enterLvl && calm) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * frac };
    }
    return null;
  }

  const stopPx = ctx.entryPx == null ? null : ctx.entryPx * 0.90; // hard stop: -10% from entry
  const watch = [
    { side: 'sell', price: exitLvl, trigger: 'below', note: 'below SMA300' },
    { side: 'sell', price: ctx.price, trigger: 'below', note: 'vol blowup exit',
      conds: [{ label: 'ATR/median', now: Math.round((atr / median) * 100) / 100, op: '>', ref: 2.2 }] }
  ];
  if (stopPx != null) watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' });
  ctx.watch(watch);

  if (prevClose < exitLvl || blowup) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  if (stopPx != null && ctx.price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
