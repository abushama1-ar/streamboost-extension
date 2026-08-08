// StreamBoost - Popup Script

const toggles = ['adBlockEnabled', 'videoControllerEnabled', 'rememberPosition', 'focusMode', 'darkMode'];
const selects = ['defaultSpeed', 'skipSeconds'];

function loadSettings() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    const settings = (response && response.settings) || {};
    toggles.forEach(key => {
      const el = document.getElementById(key);
      if (el) el.checked = !!settings[key];
    });
    selects.forEach(key => {
      const el = document.getElementById(key);
      if (el && settings[key] !== undefined) el.value = String(settings[key]);
    });
  });

  // عرض عدد العناصر المحظورة بالتبويب الحالي
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.runtime.sendMessage({ type: 'GET_BLOCKED_COUNT', tabId: tabs[0].id }, (resp) => {
        document.getElementById('blockedCount').textContent = (resp && resp.count) || 0;
      });
    }
  });
}

function saveSettings() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    const settings = (response && response.settings) || {};
    toggles.forEach(key => {
      const el = document.getElementById(key);
      if (el) settings[key] = el.checked;
    });
    selects.forEach(key => {
      const el = document.getElementById(key);
      if (el) settings[key] = parseFloat(el.value);
    });
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  [...toggles, ...selects].forEach(key => {
    const el = document.getElementById(key);
    if (el) el.addEventListener('change', saveSettings);
  });
});
