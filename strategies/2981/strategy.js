/*
 * @coinsori-strategy v1
 * name: Keltner MR Basket TP-only (no stop)
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Isolation test — v1 exits (EMA20/RSI60) PLUS an upper-Keltner-band
 * take-profit, but NO hard stop. Used to separate the effect of the take-profit from the
 * effect of the stop-loss on the v2 result.
 * When it buys and sells: Same entry as v1 (lower band + RSI<40 + rising SMA200, 25% equity
 * each). Sell on EMA20 snap-back, RSI>60, or price reaching the upper Keltner band.
 * When it does NOT work: Same regimes as v1 — broad bear keeps it flat; no stop means a
 * falling knife can ride down. Test-only variant.
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (ema20 == null || atr == null || rsi == null || sma200 == null || sma200prev == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  const lowerBand = ema20 - 2.5 * atr;
  const upperBand = ema20 + 2.5 * atr;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: upperBand, trigger: 'above', note: 'upper Keltner TP' },
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back' },
      { side: 'sell', note: 'RSI>60 exit', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 60, closed: true }] }
    ]);

    if (price > upperBand || price > ema20 || rsi > 60) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const uptrend = sma200 > sma200prev;
  ctx.watch([
    {
      side: 'buy',
      price: lowerBand,
      trigger: 'below',
      note: 'lower Keltner entry',
      conds: [
        { label: 'SMA200 rising', ok: uptrend },
        { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true }
      ]
    }
  ]);

  if (uptrend && price < lowerBand && rsi < 40) {
    const equity = ctx.cash + ctx.uPnl;
    const targetValue = 0.25 * (Number.isFinite(equity) && equity > 0 ? equity : ctx.cash);
    const qty = targetValue / price;
    return { side: 'buy', qty: qty };
  }
  return null;
}
