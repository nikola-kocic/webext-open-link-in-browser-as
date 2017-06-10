/* jshint moz: true, esversion: 6 */

"use strict";

const isDebug = false;
var browser = browser || chrome;  // Chrome compatibility
const debug = isDebug ? console.log.bind(window.console) : () => {};

const MENU_IDS = {
  text: "open-as-text",
  html: "open-as-html",
  xml: "open-as-xml",
  image: "open-as-image",
  pdf: "open-as-pdf",
  server_type: "open-as-server-type",
};

const MIMES_HTTP = {};
MIMES_HTTP[MENU_IDS.text] = "text/plain;charset=UTF-8";
MIMES_HTTP[MENU_IDS.html] = "text/html";
MIMES_HTTP[MENU_IDS.xml] = "text/xml";
// Note:
// For image mime types, it relies on the fact that browser will correctly
// display an image even if the server sent it with a mime type that does not
// match the real image type. For instance, a PNG image sent with
// image/jpeg Content-Type will still be displayed properly.
MIMES_HTTP[MENU_IDS.image] = "image/jpeg";
MIMES_HTTP[MENU_IDS.pdf] = "application/pdf";
MIMES_HTTP[MENU_IDS.server_type] = null;

function openAs(data) {
  const menuItemId = data.menuItemId;
  const url = data.linkUrl;
  debug("openAs", menuItemId, url);

  // MIME type for selected option or null for "Server repored type"
  const mimeType = MIMES_HTTP[data.menuItemId];
  if (mimeType === undefined) {
    console.assert(mimeType, "Mime type not found for entry ", data.menuItemId);
    return;
  }

  // Create new blank tab. After it's created, attach listeners and navigate to url.

  // Reason why we don't create new tab with set URL:
  // When tab with url is created and listeners attached in promise onFulfilled,
  // there's a race condition where page may be already loaded before listeners
  // can be attached.

  // Reason why we don't attach listeners before creating tab:
  // Firefox has a bug where URL is not mached when URL contains a port.
  // For that reason "<all_urls>" is used for urls pattern
  // and id of created tab is used to match request.

  const onTabCreated = (tab) => {
    const removeListeners = () => {
      debug("onHeadersReceived.removeListener");
      browser.webRequest.onHeadersReceived.removeListener(rewriteHeaders);
    };

    const rewriteHeaders = (e) => {
      debug("rewriteHeaders", e);
      removeListeners();

      for (const header of e.responseHeaders) {
        switch (header.name.toLowerCase()) {
          case 'content-type': {
            if (mimeType !== null) {
              debug("content-type changed from", header.value, "to", mimeType);
              header.value = mimeType;
            } else {
              debug("keeping server-reported content-type", header.value);
            }
            break;
          }
          case 'content-disposition': {
            header.value = '';
            break;
          }
        }
      }

      return {responseHeaders: e.responseHeaders};
    };

    debug("onHeadersReceived.addListener for URL", url);
    browser.webRequest.onHeadersReceived.addListener(
      rewriteHeaders,
      {urls: ["<all_urls>"], tabId: tab.id},
      ['blocking', 'responseHeaders']
    );

    const updating = browser.tabs.update(tab.id, {url: url});
    if (updating) {  // Chrome compatibility
      updating.then(/* onFulfilled: */ () => {}, /* onRejected: */ removeListeners);
    }
  };

  const creating = browser.tabs.create({url: "about:blank"}, onTabCreated);
  if (creating) {  // Chrome compatibility
    creating.then(onTabCreated);
  }
}

browser.contextMenus.create({contexts: ["link"], id: MENU_IDS.server_type, title: "Server repored type"});
browser.contextMenus.create({contexts: ["link"], id: MENU_IDS.text, title: "Text"});
browser.contextMenus.create({contexts: ["link"], id: MENU_IDS.image, title: "Image"});
browser.contextMenus.create({contexts: ["link"], id: MENU_IDS.pdf, title: "PDF"});
browser.contextMenus.create({contexts: ["link"], id: MENU_IDS.xml, title: "XML"});
browser.contextMenus.create({contexts: ["link"], id: MENU_IDS.html, title: "HTML"});
browser.contextMenus.onClicked.addListener(openAs);
