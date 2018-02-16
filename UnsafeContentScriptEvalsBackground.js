/* this source code form is subject to the terms of the mozilla public
 * license, v. 2.0. if a copy of the mpl was not distributed with this
 * file, you can obtain one at http://mozilla.org/mpl/2.0/. */

"use strict";

const ContentScriptURL = new URL(document.currentScript.src).
                           pathname.replace("Background", "Content");

var UnsafeContentScriptEvals = (function() {
  "use strict";

  const ScriptSrcCheckRE = new RegExp("(script-src)[^;]*(unsafe-eval)?", "i");
  const DefaultSrcCheckRE = new RegExp("(default-src)[^;]*(unsafe-eval)?", "i");
  const DefaultSrcGetRE = new RegExp("default-src([^;]*)", "i");

  let ActiveConfigContentScripts = {};

  async function unregisterConfigContentScript(url) {
    let cs = ActiveConfigContentScripts[url];
    if (cs) {
      try {
        await cs.unregister();
      } catch(e) {}
      delete(ActiveConfigContentScripts[url]);
    }
  }

  function messageHandler(msg, sender, sendResponse) {
    let url = msg.unregisterFor;
    if (url) {
      unregisterConfigContentScript(url);
    }
  }

  async function headerHandler(details) {
    let {url} = details;

    let CSP;
    for (let header of details.responseHeaders) {
      let name = header.name.toLowerCase();
      if (name === "content-security-policy" ||
          name === "content-security-policy-report-only") {
        let match;
        let madeChange = false;
        if (match = header.value.match(ScriptSrcCheckRE)) {
          if (!match[2]) {
            madeChange = true;
            header.value = header.value.
              replace("script-src", "script-src 'unsafe-eval'");
          }
        } else if (match = header.value.match(DefaultSrcCheckRE)) {
          if (!match[2]) {
            madeChange = true;
            let defaultSrcs = header.value.match(DefaultSrcGetRE)[1] 
            header.value = header.value.replace("default-src",
              `script-src 'unsafe-eval' ${defaultSrcs}; default-src`);
          }
        }
        if (madeChange) {
          CSP = {
            violatedDirective: match[1],
            effectiveDirective: match[1],
            disposition: name.includes("report") ? "report" : "enforce",
            originalPolicy: header.value,
            documentURI: url,
          };
        }
      }
    }

    if (CSP) {
      // Ideally, we would just do a browser.tabs.executeScript here for just
      // the frame running at document_start, but that doesn't work (it runs
      // far too late). However, using contentScripts.register does run early
      // enough, so we use that instead (and make sure it only runs for the
      // webRequest's URL, and is deactivated as soon as the content script
      // uses window.eval to setup the page script).
      await unregisterConfigContentScript(url);
      let code = `BlockUnsafeEvals(${JSON.stringify(url)},
                                   ${JSON.stringify(CSP)})`;
      ActiveConfigContentScripts[url] = await browser.contentScripts.register({
        allFrames: true,
        matches: [url],
        js: [{file: ContentScriptURL}, {code}],
        runAt: "document_start",
      });
    }

    return {responseHeaders: details.responseHeaders};
  }

  let Filters;

  function allow(filters = {urls: ["<all_urls>"]}) {
    if (Filters) {
      useCSPDefaults();
    }

    filters.types = ["main_frame", "sub_frame"];
    Filters = filters;

    browser.runtime.onMessage.addListener(messageHandler);

    browser.webRequest.onHeadersReceived.addListener(
      headerHandler,
      Filters,
      ["blocking", "responseHeaders"]
    );
  }

  function useCSPDefaults() {
    if (Filters) {
      browser.runtime.onMessage.removeListener(messageHandler);

      browser.webRequest.onHeadersReceived.removeListener(
        headerHandler,
        Filters,
        ["blocking", "responseHeaders"]
      );
      
      Filters = undefined;
    }
  }

  return {
    allow,
    useCSPDefaults,
  };
}());
