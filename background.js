// StreamBoost - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  // إعدادات افتراضية
  chrome.storage.sync.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.sync.set({
        settings: {
          adBlockEnabled: true,
          videoControllerEnabled: true,
          rememberPosition: true,
          focusMode: false,
          darkMode: false,
          defaultSpeed: 1.0,
          skipSeconds: 10
        }
      });
    }
  });
});

// تتبع حالة حظر الإعلانات لكل تبويب لعرض العداد
let blockedCounts = {};

chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
  const tabId = info.request.tabId;
  if (tabId >= 0) {
    blockedCounts[tabId] = (blockedCounts[tabId] || 0) + 1;
    chrome.action.setBadgeText({
      tabId: tabId,
      text: String(blockedCounts[tabId])
    });
    chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete blockedCounts[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    blockedCounts[tabId] = 0;
    chrome.action.setBadgeText({ tabId: tabId, text: '' });
  }
});

// استقبال رسائل من content script أو popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_BLOCKED_COUNT') {
    const tabId = sender.tab ? sender.tab.id : message.tabId;
    sendResponse({ count: blockedCounts[tabId] || 0 });
  }
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(['settings'], (result) => {
      sendResponse({ settings: result.settings });
    });
    return true; // async response
  }
  if (message.type === 'UPDATE_SETTINGS') {
    chrome.storage.sync.set({ settings: message.settings }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
