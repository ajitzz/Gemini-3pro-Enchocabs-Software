const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const target1 = `    await client.query('COMMIT');
    await invalidateSummaryCache();
    await invalidateKeys(DRIVERS_CACHE_KEY);
    emitLiveUpdate('drivers_changed');`;
const replacement1 = `    await client.query('COMMIT');
    await invalidateSummaryCache();
    await invalidateKeys(DRIVERS_CACHE_KEY);
    await invalidateDailyEntriesCache();
    await invalidateWeeklyWalletsCache();
    await invalidateDriverExpensesCache();
    emitLiveUpdate('drivers_changed');`;

const target2 = `    const result = await db.query('DELETE FROM drivers WHERE id = $1', [req.params.id]);
    await invalidateSummaryCache();
    await invalidateKeys(DRIVERS_CACHE_KEY);
    emitLiveUpdate('drivers_changed');`;
const replacement2 = `    const result = await db.query('DELETE FROM drivers WHERE id = $1', [req.params.id]);
    await invalidateSummaryCache();
    await invalidateKeys(DRIVERS_CACHE_KEY);
    await invalidateDailyEntriesCache();
    await invalidateWeeklyWalletsCache();
    await invalidateDriverExpensesCache();
    emitLiveUpdate('drivers_changed');`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);

fs.writeFileSync('server/index.js', code);
console.log("Patched server/index.js successfully!");
