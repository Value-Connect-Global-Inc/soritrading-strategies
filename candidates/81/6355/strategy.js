/*
 * @coinsori-strategy v1
 * name: ETH ATR-Calm Trend Rider 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The ATR-calm trend mechanism is the one edge that held up on BTC 4h: ride a slow uptrend but enter only when volatility is calm and exit early when it explodes. It generalizes to ETH in normal and choppy regimes, but its calm filter keeps it flat during sustained high-volatility bull markets. This version adds one principled override: when the uptrend is already strongly established (price far above the 300-bar average), elevated ATR is the trend's own signature, not a pending reversal — so it rides strong trends through high vol instead of sitting out.
 * When it buys and sells: buys when the previous bar closes above the 300-bar average AND (volatility is calm — ATR below 1.2x its 60-bar median — OR the trend is strongly established, price above 1.15x the 300-bar average); sells when the previous bar closes below the 300-bar average, or immediately when ATR exceeds 2.2x its median UNLESS the trend is strongly established.
 * When it does NOT work: in a choppy market with no clear direction the trend filter whipsaws. If a parabolic rally reverses violently, riding it through high vol gives back gains before the SMA300 exit fires. In long sideways chop it sits out and misses nothing while holding chops.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma300 = ctx.sma(300, 1);
  if (sma300 == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // Rolling ATR history in state -> median (median is robust to a few huge bars).
  const hist = ctx.state.atrHist || [];
  hist.push(atr);
  if (hist.length > 120) hist.shift();
  ctx.state.atrHist = hist;
  if (hist.length < 60) { ctx.watch([]); return null; }
  const sorted = [...hist].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Strong established uptrend: price far above the trend line. Elevated ATR here is
  // the trend's own signature (parabolic bull), not a pending reversal signal.
  const strongTrend = prevClose > sma300 * 1.15;
  const calm = atr < median * 1.2;          // enter only when vol is near its recent normal
  const blowup = atr > median * 2.2;        // vol explosion -> step out before the break
  const blowupExit = blowup && !strongTrend; // but ride a strong trend through high vol

  const enterLvl = sma300 * 1.01;
  const exitLvl = sma300 * 0.99;

  if (ctx.position <= 0) {
    ctx.watch([{
      side: 'buy', price: enterLvl, trigger: 'above', note: 'above SMA300',
      conds: [
        { label: 'ATR calm', ok: calm },
        { label: 'strong trend', ok: strongTrend }
      ]
    }]);
    if (prevClose > enterLvl && (calm || strongTrend)) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 };
    }
    return null;
  }

  ctx.watch([
    { side: 'sell', price: exitLvl, trigger: 'below', note: 'below SMA300' },
    { side: 'sell', price: ctx.price, trigger: 'below', note: 'vol blowup exit',
      conds: [{ label: 'ATR/median', now: Math.round((atr / median) * 100) / 100, op: '>', ref: 2.2 },
              { label: 'strong trend', ok: !strongTrend }] }
  ]);
  if (prevClose < exitLvl || blowupExit) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
