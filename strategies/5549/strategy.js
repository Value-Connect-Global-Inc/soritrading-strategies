/*
 * @coinsori-strategy v1
 * name: BTC OnChain-Gate VolTarget 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's daily active addresses (network usage) are a leading adoption signal. Buying a 20-day breakout only when on-chain usage is growing filters out speculative price spikes that have no real network activity behind them. Volatility-targeted sizing caps drawdown by construction.
 * When it buys and sells: Buy on a 20-day high breakout while the 30-day average of active addresses is above its value 30 days ago AND price is above its 200-day average. Position size = equity * 5% / (2.5 * ATR). Sell on a 50-day low break or a 2.5x ATR hard stop.
 * When it does NOT work: Address data lags price, so entries can be late and the gate can keep you out at the very start of a rally before usage catches up. In a bear market where usage falls but price dead-cat bounces, the breakout filter still whipsaws.
 */
function onUpdate(ctx) {
  const addr = ctx.data("addr_sma30");
  if (addr == null) return null;

  // Rolling 30-day history of on-chain usage kept in restart-safe state.
  let hist = ctx.state.addrHist || [];
  hist.push(addr);
  if (hist.length > 30) hist = hist.slice(-30);
  ctx.state.addrHist = hist;
  if (hist.length < 30) return null; // need a full 30-day window to judge growth

  // On-chain gate: usage now above its level 30 days ago = network growing.
  const usageGrowing = addr > hist[0];

  const price = ctx.price;
  const pos = ctx.position;
  const entry = ctx.entryPx;
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || atr <= 0 || sma200 == null) return null;

  // --- Exits while holding: hard stop OR 50-day low break (wide = lets trend breathe).
  if (pos > 0 && entry != null) {
    const stop = entry - 2.5 * atr;
    const low50 = ctx.low(50, 1);
    const arr = [{ side:'sell', price: stop, trigger:'below', note:'hard stop 2.5x ATR' }];
    if (low50 != null) arr.push({ side:'sell', price: low50, trigger:'below', note:'50-day low break' });
    ctx.watch(arr);
    if (price <= stop) return { side:'sell', qty: pos, reduceOnly: true };
    if (low50 != null && price <= low50) return { side:'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // --- Entry: 20-day breakout while on-chain usage is growing AND price above SMA200.
  const hi20 = ctx.high(20, 1);
  if (hi20 != null && usageGrowing && price > sma200 && price > hi20) {
    // Vol-target size: risk 5% of equity on a 2.5x ATR stop.
    const riskPerTrade = 0.05 * ctx.cash;
    const stopDist = 2.5 * atr;
    let qty = riskPerTrade / stopDist;
    const maxQty = ctx.cash / price * 0.99;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.watch([{ side:'buy', price: hi20, trigger:'above', note:'20d breakout & usage up & SMA200' }]);
    return { side:'buy', qty: qty };
  }

  ctx.watch([{ side:'buy', note:'waiting 20d breakout & usage up & SMA200' }]);
  return null;
}
