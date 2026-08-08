// StreamBoost - Content Script
(function () {
  let settings = {
    adBlockEnabled: true,
    videoControllerEnabled: true,
    rememberPosition: true,
    focusMode: false,
    darkMode: false,
    defaultSpeed: 1.0,
    skipSeconds: 10
  };

  let currentVideo = null;
  let controllerEl = null;
  let saveInterval = null;

  // ===== تحميل الإعدادات =====
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    if (response && response.settings) {
      settings = { ...settings, ...response.settings };
    }
    init();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      settings = { ...settings, ...changes.settings.newValue };
      applySettingsToPage();
    }
  });

  function init() {
    applySettingsToPage();
    if (settings.adBlockEnabled) {
      setupPopupBlocker();
      removeAnnoyingOverlays();
    }
    if (settings.videoControllerEnabled) {
      watchForVideos();
    }
  }

  function applySettingsToPage() {
    document.documentElement.classList.toggle('sb-dark-mode', !!settings.darkMode);
    document.body && document.body.classList.toggle('sb-focus-mode', !!settings.focusMode);
  }

  // ===== مراقبة ظهور الفيديوهات بأي صفحة (Universal) =====
  function watchForVideos() {
    const scan = () => {
      const videos = Array.from(document.querySelectorAll('video'));
      const visible = videos.find(v => v.offsetWidth > 100 && v.offsetHeight > 100);
      if (visible && visible !== currentVideo) {
        attachToVideo(visible);
      }
    };

    scan();
    const observer = new MutationObserver(() => scan());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(scan, 2000);
  }

  function attachToVideo(video) {
    currentVideo = video;
    buildController(video);
    if (settings.defaultSpeed && settings.defaultSpeed !== 1.0) {
      video.playbackRate = settings.defaultSpeed;
    }
    if (settings.rememberPosition) {
      setupResumeWatching(video);
    }
  }

  // ===== متحكم الفيديو العائم =====
  function buildController(video) {
    if (controllerEl) controllerEl.remove();

    controllerEl = document.createElement('div');
    controllerEl.id = 'sb-controller';
    controllerEl.innerHTML = `
      <div class="sb-toggle" title="إخفاء/إظهار">⚡</div>
      <div class="sb-panel">
        <button class="sb-btn" data-action="skip-back">⏪ ${settings.skipSeconds}</button>
        <button class="sb-btn" data-action="speed-down">−</button>
        <span class="sb-speed-display">${video.playbackRate.toFixed(2)}x</span>
        <button class="sb-btn" data-action="speed-up">+</button>
        <button class="sb-btn" data-action="skip-fwd">${settings.skipSeconds} ⏩</button>
        <div class="sb-divider"></div>
        <button class="sb-btn" data-action="pip" title="صورة داخل صورة">📺</button>
        <button class="sb-btn" data-action="bright-down">🔅</button>
        <button class="sb-btn" data-action="bright-up">🔆</button>
        <div class="sb-divider"></div>
        <button class="sb-btn" data-action="focus" title="وضع التركيز">🎯</button>
      </div>
    `;
    document.body.appendChild(controllerEl);

    const speedDisplay = controllerEl.querySelector('.sb-speed-display');
    let brightness = 1.0;

    controllerEl.querySelector('.sb-toggle').addEventListener('click', () => {
      controllerEl.classList.toggle('sb-collapsed');
    });

    controllerEl.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (!action) return;
      switch (action) {
        case 'skip-back':
          video.currentTime = Math.max(0, video.currentTime - settings.skipSeconds);
          break;
        case 'skip-fwd':
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + settings.skipSeconds);
          break;
        case 'speed-down':
          video.playbackRate = Math.max(0.25, +(video.playbackRate - 0.25).toFixed(2));
          speedDisplay.textContent = video.playbackRate.toFixed(2) + 'x';
          break;
        case 'speed-up':
          video.playbackRate = Math.min(3, +(video.playbackRate + 0.25).toFixed(2));
          speedDisplay.textContent = video.playbackRate.toFixed(2) + 'x';
          break;
        case 'pip':
          if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
          } else if (video.requestPictureInPicture) {
            video.requestPictureInPicture().catch(() => {});
          }
          break;
        case 'bright-up':
          brightness = Math.min(2, brightness + 0.1);
          video.style.filter = `brightness(${brightness}) contrast(1.05)`;
          break;
        case 'bright-down':
          brightness = Math.max(0.3, brightness - 0.1);
          video.style.filter = `brightness(${brightness}) contrast(1.05)`;
          break;
        case 'focus':
          settings.focusMode = !settings.focusMode;
          document.body.classList.toggle('sb-focus-mode', settings.focusMode);
          chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
          break;
      }
    });

    // اختصارات كيبورد
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.target !== document.body && e.target !== video) return;
      if (e.code === 'ArrowRight' && e.shiftKey) {
        video.currentTime += settings.skipSeconds;
      } else if (e.code === 'ArrowLeft' && e.shiftKey) {
        video.currentTime -= settings.skipSeconds;
      }
    });
  }

  // ===== استئناف المشاهدة =====
  function getVideoKey() {
    return 'sb_pos_' + location.hostname + location.pathname;
  }

  function setupResumeWatching(video) {
    const key = getVideoKey();

    chrome.storage.local.get([key], (result) => {
      const saved = result[key];
      if (saved && saved.time > 10 && (video.duration === 0 || saved.time < video.duration - 15)) {
        showResumeToast(video, saved.time);
      }
    });

    if (saveInterval) clearInterval(saveInterval);
    saveInterval = setInterval(() => {
      if (!video.paused && video.currentTime > 5) {
        chrome.storage.local.set({
          [key]: { time: video.currentTime, title: document.title, savedAt: Date.now() }
        });
      }
    }, 5000);

    video.addEventListener('ended', () => {
      chrome.storage.local.remove(key);
    });
  }

  function showResumeToast(video, time) {
    const old = document.getElementById('sb-resume-toast');
    if (old) old.remove();

    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const toast = document.createElement('div');
    toast.id = 'sb-resume-toast';
    toast.innerHTML = `
      <span>تكمل من ${mins}:${secs.toString().padStart(2, '0')}؟</span>
      <button data-act="yes">متابعة</button>
      <button data-act="no" style="background:rgba(255,255,255,0.15)">لأ</button>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('sb-show'));

    toast.addEventListener('click', (e) => {
      if (e.target.dataset.act === 'yes') {
        video.currentTime = time;
      }
      toast.classList.remove('sb-show');
      setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
      toast.classList.remove('sb-show');
      setTimeout(() => toast.remove(), 300);
    }, 8000);
  }

  // ===== حظر النوافذ المنبثقة (popunder/popup) =====
  function setupPopupBlocker() {
    const originalOpen = window.open;
    window.open = function (...args) {
      console.log('[StreamBoost] تم حظر محاولة فتح نافذة منبثقة:', args[0]);
      return null;
    };

    // منع فتح نوافذ جديدة عبر window.open على إطارات فرعية أيضاً
    document.addEventListener('click', (e) => {
      const target = e.target.closest('a[target="_blank"]');
      if (target && target.href && /^(javascript:|#)/.test(target.href) === false) {
        // نسمح بالروابط العادية بس نمنع popunder المخفية فقط
      }
    }, true);
  }

  // ===== إزالة العناصر المزعجة (overlays/popups متكررة) =====
  function removeAnnoyingOverlays() {
    const suspiciousSelectors = [
      '[class*="popup-ad"]', '[class*="popunder"]', '[id*="popup-ad"]',
      '[class*="overlay-ad"]', '[class*="sticky-ad"]', 'div[style*="z-index: 999999"]',
      '[class*="adsbygoogle"]'
    ];

    const clean = () => {
      suspiciousSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          // تأكد ما يحذف الفيديو الأساسي أو حاويته
          if (!el.querySelector('video') && el.id !== 'sb-controller') {
            el.style.display = 'none';
          }
        });
      });
    };

    clean();
    const observer = new MutationObserver(() => clean());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
