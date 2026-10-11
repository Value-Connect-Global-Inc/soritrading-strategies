/* 2026-04-26: 표시만 바뀜, 매매 판단은 그대로 */
/*
 * @coinsori-strategy v1
 * name: BTC 1D Fear-Greed Contrarian v2
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy:
 * The crypto Fear & Greed index is a sentiment oscillator. Fear readings mark
 * accumulation zones and greed marks distribution. This v2 uses a gentler entry
 * (index <= 30, "fear") than v1's extreme <=20, so it catches more signals and
 * avoids only trading deep bears. Exits purely on sentiment (index >= 60, "greed")
 * with no hard price stop, so it does not get stopped out in a normal pullback.
 * When it buys and sells:
 * Buys one daily bar after the index closes at or below 30. Sells when it reaches 60+.
 * When it does NOT work:
 * In a sustained bull market the index stays high (60-80) and almost never triggers
 * a fear entry — it sits in cash and lags buy-and-hold badly. In a grinding bear it
 * buys repeatedly and each round trip loses until sentiment finally turns.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const price = ctx.price;
  if (fg == null || price == null) return null;

  if (ctx.position > 0) {
    ctx.watch([{ side: 'sell', note: 'FG >= 60', conds: [{ label: 'Fear & Greed', now: fg, op: '>=', ref: 60 }] }]);
    if (fg >= 60) {
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', note: 'FG <= 30', conds: [{ label: 'Fear & Greed', now: fg, op: '<=', ref: 30 }] }]);
  if (fg <= 30) {
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
