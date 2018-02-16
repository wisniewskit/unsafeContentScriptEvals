/* this source code form is subject to the terms of the mozilla public
 * license, v. 2.0. if a copy of the mpl was not distributed with this
 * file, you can obtain one at http://mozilla.org/mpl/2.0/. */

"use strict";

let initialEvalParam = "Successfully bypassed csp; running in the page script";

// The addon ensures that this works during the document_start phase:
let port = window.eval(`(function(announcement) {
  "use strict";

  // Note that wrapping in an anonymous closure like this prevents us
  // from bleeding variables out for the page to see.

  // You can pass in initial parameters with JSON.stringify()
  console.log(announcement);

  // You can override window properties or polyfill features
  Object.defineProperty(navigator, "test", {
    get: () => "I'm here!",
    configurable: true,
  });

  // If you want to later communicate with this scope again in a safe
  // way, you can also return a MessagePort from this eval call:
  let channel = new MessageChannel();

  // You can listen to messages sent in from the outer content script:
  channel.port1.onmessage = e => {
    // e.data contains the message
    console.log(e.data);

    // Likewise, you can send messages back out to the content script:
    channel.port1.postMessage("got pong from inner page script");
  };

  return channel.port2;
})(${JSON.stringify(initialEvalParam)})`);

// You can now listen for messages from the page script closure above:
port.onmessage = e => { 
  console.log(e.data); 
};

// You can also send it messages:
port.postMessage("got ping from outer content script");
