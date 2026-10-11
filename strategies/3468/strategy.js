/*
 * @coinsori-strategy v1
 * name: Funding Rate & Volatility Mean Reversion BTC 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Extreme funding rates paired with Bollinger Band extremes signal leveraged overextension ripe for mean reversion.
 * When it buys and sells: Buys when Bollinger Band lower band is breached during negative/low funding or extreme fear, sells at the middle band.
 * When it does not work: Fails during sustained strong trending markets where funding stays one-sided.
 */

function onUpdate(ctx) {
    const price = ctx.price;
    if (price == null) return null;

    const bb = ctx.bb(20, 2, 1);
    const prevBb = ctx.bb(20, 2, 2);
    if (bb == null || prevBb == null) return null;

    const fg = ctx.data('fg');
    if (fg == null) return null;

    const pos = ctx.position;

    ctx.watch([
        { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower touch & FG < 30',
          conds: [
              { label: 'Fear & Greed < 30', now: fg, op: '<', ref: 30, closed: true },
              { label: 'Close <= BB Lower', ok: price <= bb.lower }
          ] },
        { side: 'sell', price: bb.mid, trigger: 'above', note: 'BB Mid target' }
    ]);

    // Entry: Price touches or drops below lower Bollinger Band when sentiment is fearful (FG < 30)
    if (pos <= 0 && price <= bb.lower && fg < 30) {
        const qty = ctx.cash / price * 0.99;
        if (qty > 0) {
            return { side: 'buy', qty };
        }
    }

    // Exit: Price reaches middle Bollinger Band
    if (pos > 0 && price >= bb.mid) {
        return { side: 'sell', qty: pos };
    }

    return null;
}
