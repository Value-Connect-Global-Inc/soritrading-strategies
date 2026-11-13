/*
 * @coinsori-strategy v1
 * name: SOL ATR-Calm Trend Rider 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: SOL 4h trend-following works, but its drawdowns come from entering right before a volatility explosion and then getting whipsawed. This strategy rides the same 300-bar uptrend as a plain regime filter, but only enters when volatility is calm (ATR near its own recent median) and exits early when volatility blows up — volatility explosions usually precede the trend break. Same validated mechanism as the BTC version.
 * When it buys and sells: buys when the previous bar closes above the 300-bar average AND the 14-bar ATR is below 1.2x its own 60-bar median (calm); sells when the previous bar closes below the 300-bar average, or immediately when ATR exceeds 2.2x its median (volatility blowup).
 * When it does NOT work: in a sustained high-volatility bull market ATR stays elevated for months, the calm filter keeps the strategy flat and it misses the whole rally. Also, a strong accelerating trend can blow up ATR and get stopped out early. In long sideways chop the trend filter still whipsaws.
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

  const calm = atr < median * 1.2;   // enter only when vol is near its recent normal
  const blowup = atr > median * 2.2; // vol explosion -> step out before the break

  const enterLvl = sma300 * 1.01;
  const exitLvl = sma300 * 0.99;

  if (ctx.position <= 0) {
    ctx.watch([{
      side: 'buy', price: enterLvl, trigger: 'above', note: 'above SMA300',
      conds: [{ label: 'ATR calm', ok: calm }]
    }]);
    if (prevClose > enterLvl && calm) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 };
    }
    return null;
  }

  ctx.watch([
    { side: 'sell', price: exitLvl, trigger: 'below', note: 'below SMA300' },
    { side: 'sell', price: ctx.price, trigger: 'below', note: 'vol blowup exit',
      conds: [{ label: 'ATR/median', now: Math.round((atr / median) * 100) / 100, op: '>', ref: 2.2 }] }
  ]);
  if (prevClose < exitLvl || blowup) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
