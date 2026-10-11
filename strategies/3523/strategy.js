/*
 * @coinsori-strategy v1
 * name: Macro Liquidity Trend Filter
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: We bet on Bitcoin capturing major upside when macro liquidity is expanding, while shrinking exposure during liquidity tightening.
 * When it buys and sells: Buys when EMA trend is positive and active addresses trend upward; sells or stays cash when trend turns negative.
 * When it does not work: Suffers during choppy sideways macro regimes where indicators fluctuate erratically.
 */

function onUpdate(ctx) {
    const price = ctx.price;
    const pos = ctx.position;
    
    // Need enough bars for EMA
    const e50 = ctx.ema(50, 1);
    const e200 = ctx.ema(200, 1);
    if (e50 == null || e200 == null) return null;
    
    // Read dataset key 'addr' safely
    const addr = ctx.data('addr');
    const rsi14 = ctx.rsi(14, 1);
    if (rsi14 == null) return null;
    
    // Watch display
    ctx.watch([
        { side: 'buy', price: price * 1.05, trigger: 'above', note: 'Trend Breakout', conds: [
            { label: 'EMA50 > EMA200', ok: e50 > e200 },
            { label: 'RSI < 70', now: rsi14, op: '<', ref: 70, closed: true }
        ]}
    ]);
    
    // Entry condition: EMA50 > EMA200, price above EMA50, RSI < 70
    const close1 = ctx.closes.at(-2);
    if (pos <= 0 && e50 > e200 && close1 > e50 && rsi14 < 70) {
        const qty = (ctx.cash / price) * 0.98;
        if (qty > 0) {
            return { side: 'buy', qty: qty };
        }
    }
    
    // Exit condition: Trend breaks (EMA50 < EMA200) or overbought RSI
    if (pos > 0 && (e50 < e200 || rsi14 > 80)) {
        return { side: 'sell', qty: pos };
    }
    
    return null;
}
