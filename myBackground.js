/* this source code form is subject to the terms of the mozilla public
 * license, v. 2.0. if a copy of the mpl was not distributed with this
 * file, you can obtain one at http://mozilla.org/mpl/2.0/. */

"use strict";

UnsafeContentScriptEvals.allow({urls: ["<all_urls>"]});

//UnsafeContentScriptEvals.useCSPDefaults();

browser.browserAction.onClicked.addListener((tab) => {
  browser.tabs.executeScript(tab.id, {
    allFrames: true,
    code: `window.eval("console.log('Addon button was clicked!')")`
  });
});
