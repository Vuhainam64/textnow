/**
 * logicNodes.js
 * Handlers cho các khối Logic: Khai báo biến, Lặp lại, Điều kiện, Chờ đợi
 */

export async function handleKhaiBaoBien(executionId, config, context, engine) {
    const lines = (config.variables || '').split('\n');
    let count = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        if (!key) continue;
        context[key] = engine._resolveValue(val, context);
        count++;
    }
    context.log(`   + Đã khai báo ${count} biến vào context.`);
    return true;
}

export async function handleLapLai(executionId, config, context, node, engine) {
    const loopKey = `_loop_${node.id}`;
    context[loopKey] = (context[loopKey] || 0) + 1;
    const maxRetries = parseInt(config.max_retries) || 3;

    if (context[loopKey] <= maxRetries) {
        context.log(`   Lan thu ${context[loopKey]}/${maxRetries}...`);
        return true;
    } else {
        delete context[loopKey];
        context.log(`   Da thu ${maxRetries} lan — thoat vong lap.`, 'warning');
        return false;
    }
}

export async function handleDieuKien(executionId, config, context, engine) {
    if (!context.page) {
        context.log(`   Trinh duyet chua duoc mo`, 'error');
        return false;
    }
    const { type, selector } = config;
    const resolvedSelector = engine._resolveValue(selector, context);
    context.log(`   + Kiem tra: ${type} voi "${resolvedSelector}"`);
    if (!resolvedSelector) return false;
    const condTimeout = (parseInt(config.timeout) || 10) * 1000;
    try {
        if (type === 'element_exists') {
            await context.page.waitForSelector(resolvedSelector, { timeout: condTimeout });
            context.log(`   + Phan tu ton tai`);
            return true;
        } else if (type === 'element_not_exists') {
            await context.page.waitForSelector(resolvedSelector, { state: 'hidden', timeout: condTimeout });
            context.log(`   + Phan tu da bien mat`);
            return true;
        } else if (type === 'text_exists') {
            const content = await context.page.content();
            const found = content.includes(resolvedSelector);
            context.log(found ? `   + Tim thay text` : `   - Khong tim thay text`);
            return found;
        }
        return false;
    } catch {
        context.log(`   - Khong tim thay / timeout`);
        return false;
    }
}

export async function handleChoDoi(executionId, config, context, engine) {
    const ms = (parseInt(config.seconds) || 5) * 1000;
    context.log(`   + Cho ${config.seconds} giay...`);
    await engine._wait(executionId, ms);
    return true;
}
