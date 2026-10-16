/*
 * @coinsori-strategy v1
 * name: BTC Fed-Money Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin behaves as a risk-on liquidity asset. When the fed
 * funds rate is near zero (free money), capital flows into high-beta assets like
 * crypto; when the rate rises the risk-off regime dominates and crypto bleeds.
 * When it buys and sells: Long BTC whenever the fed funds rate is below 2.0%
 * (cheap-money regime); go flat when the rate is at or above 2.0%. A 20% hard
 * stop caps any single position.
 * When it does NOT work: In a rising-rate environment crypto can still rally on
 * its own catalysts (halvings, adoption) — this strategy sits out those moves;
 * and in a zero-rate regime it is essentially always long, so it rides every
 * crash that happens while money is still cheap.
 */

function onUpdate(ctx) {
  const fed = ctx.data('fed');
  if (fed == null) return null;
  const cheapMoney = fed < 2.0; // 2% = real rates turn positive, free-money regime ends
  const pos = ctx.position || 0;

  if (pos === 0) {
    if (cheapMoney) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    ctx.watch([{ side: 'buy', note: 'enter when fed funds < 2%', conds: [{ label: 'fed funds %', now: fed, op: '<', ref: 2.0, closed: true }] }]);
    return null;
  }

  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : null; // 20% hard stop: cap single-position loss
  ctx.watch([
    { side: 'sell', note: 'exit when fed funds >= 2%', conds: [{ label: 'fed funds %', now: fed, op: '>=', ref: 2.0, closed: true }] },
    ...(stop ? [{ side: 'sell', price: stop, trigger: 'below', note: '20% hard stop' }] : [])
  ]);
  if (!cheapMoney) return { side: 'sell', qty: pos };
  if (stop && ctx.price <= stop) return { side: 'sell', qty: pos };
  return null;
}
