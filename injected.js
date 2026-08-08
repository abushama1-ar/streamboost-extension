// StreamBoost - Injected Script (يعمل بسياق الصفحة - MAIN world)
// هذا الملف ضروري لأن content scripts بـ isolated world ما بقدر يوقف
// window.open الحقيقي اللي بتستدعيه سكربتات الصفحة نفسها.

(function () {
  if (window.__sbPopupBlockerInstalled) return;
  window.__sbPopupBlockerInstalled = true;

  const realOpen = window.open;

  window.open = function (...args) {
    // نسمح فقط لو المستخدم نفسه ضغط بشكل مباشر (trusted event) خلال آخر 1.2 ثانية
    const now = Date.now();
    if (window.__sbLastUserClick && now - window.__sbLastUserClick < 1200) {
      return realOpen.apply(window, args);
    }
    console.log('[StreamBoost] تم حظر popup/popunder غير مرغوب فيه');
    return null;
  };

  document.addEventListener('pointerdown', () => {
    window.__sbLastUserClick = Date.now();
  }, true);
})();
