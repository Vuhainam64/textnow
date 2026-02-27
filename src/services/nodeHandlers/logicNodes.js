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
    engine._log(executionId, `   + Đã khai báo ${count} biến vào context.`);
    return true;
}

export async function handleLapLai(executionId, config, context, node, engine) {
    const loopKey = `_loop_${node.id}`;
    context[loopKey] = (context[loopKey] || 0) + 1;
    const maxRetries = parseInt(config.max_retries) || 3;

    if (context[loopKey] <= maxRetries) {
        engine._log(executionId, `   Lan thu ${context[loopKey]}/${maxRetries}...`);
        return true;
    } else {
        delete context[loopKey];
        engine._log(executionId, `   Da thu ${maxRetries} lan — thoat vong lap.`, 'warning');
        return false;
    }
}

export async function handleDieuKien(executionId, config, context, engine) {
    if (!context.page) {
        engine._log(executionId, `   Trinh duyet chua duoc mo`, 'error');
        return false;
    }
    const { type, selector } = config;
    const resolvedSelector = engine._resolveValue(selector, context);
    engine._log(executionId, `   + Kiem tra: ${type} voi "${resolvedSelector}"`);
    if (!resolvedSelector) return false;
    const condTimeout = (parseInt(config.timeout) || 10) * 1000;
    try {
        if (type === 'element_exists') {
            await context.page.waitForSelector(resolvedSelector, { timeout: condTimeout });
            engine._log(executionId, `   + Phan tu ton tai`);
            return true;
        } else if (type === 'element_not_exists') {
            await context.page.waitForSelector(resolvedSelector, { state: 'hidden', timeout: condTimeout });
            engine._log(executionId, `   + Phan tu da bien mat`);
            return true;
        } else if (type === 'text_exists') {
            const content = await context.page.content();
            const found = content.includes(resolvedSelector);
            engine._log(executionId, found ? `   + Tim thay text` : `   - Khong tim thay text`);
            return found;
        }
        return false;
    } catch {
        engine._log(executionId, `   - Khong tim thay / timeout`);
        return false;
    }
}

export async function handleChoDoi(executionId, config, context, engine) {
    const ms = (parseInt(config.seconds) || 5) * 1000;
    engine._log(executionId, `   + Cho ${config.seconds} giay...`);
    await engine._wait(executionId, ms);
    return true;
}
