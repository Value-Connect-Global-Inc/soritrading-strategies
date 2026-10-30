/*
 * @coinsori-strategy v1
 * name: Funding-Contrarian Basket 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Perpetual funding rate measures the mood of leveraged traders. Deeply negative
 * funding means shorts are paying longs — a crowded short side that historically marks a local bottom
 * when price is still in an uptrend. This is a positioning/sentiment signal, not a price signal.
 * When it buys and sells: buys a coin when its funding rate is below -0.00005 (crowded shorts) AND the
 * 200-bar average is rising (regime filter, so we do not catch falling knives in a bear). Sells the
 * whole position when funding turns positive (> 0.0003, crowd back to greedy) or price breaks a 3xATR
 * hard stop below entry.
 * When it does NOT work: in a persistent downtrend the rising-average gate keeps it flat (no shorting);
 * if funding data is missing for a symbol it never trades that symbol. Very negative funding in a bear
 * market is a falling knife, which is why the trend filter is mandatory.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const funding = ctx.funding;
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma200prev == null || atr == null || atr <= 0) return null;
  const uptrend = sma200 > sma200prev;
  const pos = ctx.pos(sym);
  if (pos > 0) {
    const entry = ctx.entryPx;
    const tp = entry != null && entry > 0 ? entry + 4 * atr : null;
    const hardStop = entry != null && entry > 0 ? entry - 3 * atr : null;
    const watchList = [];
    if (tp != null) watchList.push({ side: 'sell', price: tp, trigger: 'above', note: 'take profit 4 ATR' });
    if (hardStop != null) watchList.push({ side: 'sell', price: hardStop, trigger: 'below', note: 'hard stop 3 ATR' });
    ctx.watch(watchList);
    if ((tp != null && price >= tp) || (hardStop != null && price <= hardStop) || (funding != null && funding > 0.0003)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (funding == null) return null;
  // 0.00005 = 0.005% per 8h — extreme negative funding means crowded shorts, the contrarian buy signal.
  const crowdShorts = funding < -0.00005;
  if (crowdShorts && uptrend) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
