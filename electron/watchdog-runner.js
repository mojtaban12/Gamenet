// این فایل با ELECTRON_RUN_AS_NODE=1 اجرا می‌شه (نه با app.whenReady عادی)
// یعنی Chromium/GPU/پنجره اصلاً بالا نمی‌آد — فقط Node خالی. این باعث می‌شه
// وقتی Task Scheduler هر ۱ دقیقه این رو با یوزر SYSTEM (بدون سشن دسکتاپ) صدا
// می‌زنه، دیگه گیر مشکلات GUI-زیر-SYSTEM نیفته و مستقیم بره سراغ چک/پاک‌سازی.
const { runCrashWatchdogOnce } = require('./crash-watchdog')

runCrashWatchdogOnce()
    .catch(() => {})
    .finally(() => process.exit(0))
