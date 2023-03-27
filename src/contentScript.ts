"use strict";
// import axios from "axios";

// // Content script file will run in the context of web page.
// // With content script you can manipulate the web pages using
// // Document Object Model (DOM).
// // You can also pass information to the parent extension.

// // We execute this script by making an entry in manifest.json file
// // under `content_scripts` property

// // For more information on Content Scripts,
// // See https://developer.chrome.com/extensions/content_scripts

// const handleXHR = (
//   type: "GET" | "POST",
//   url: string,
//   data: FormData | null,
//   cb: XHRcb
// ) => {
//   const xhr = new XMLHttpRequest();
//   xhr.open(type, url, true);
//   xhr.withCredentials = true;
//   xhr.setRequestHeader(
//     "accept",
//     "application/vnd.linkedin.normalized+json+2.1"
//   );
//   xhr.setRequestHeader("csrf-token", CSRF_TOKEN);
//   xhr.setRequestHeader("x-li-lang", "en_US");
//   xhr.setRequestHeader(
//     "x-li-track",
//     '{"clientVersion":"1.2.3179","osName":"web","timezoneOffset":-7,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}'
//   );
//   xhr.setRequestHeader("x-restli-protocol-version", "2.0.0");
//   xhr.send(data);
//   xhr.onreadystatechange = function () {
//     if (xhr.readyState === 4) {
//       cb(JSON.parse(this.response));
//     }
//   };
// };

import axios from "axios";

// Get CSRF token from cookie
const COOKIE = document.cookie;
const match = COOKIE.match(/JSESSIONID="(.*)"/);
const CSRF_TOKEN = match ? match[1].split('"')[0] : "";

interface ConnectionCount {
  htmlCount: number;
  trueCount: number;
}

// Get connection count
const getConnectionCount = async (): Promise<ConnectionCount> => {
  // Get HTML node containing connection count
  const [HTMLnode] = document.getElementsByClassName(
    "mn-connections__header"
  ) as HTMLCollectionOf<HTMLElement>;

  let htmlCount = 0;
  let trueCount = 0;

  if (HTMLnode) {
    // Parse HTML node text to get connection count
    htmlCount =
      parseInt(HTMLnode.innerText.split(" ")[0].replace(/,/g, "")) || 0;
  }

  // Make API call to get actual number of connections
  const url = `https://www.linkedin.com/voyager/api/relationships/connections?count=${htmlCount}&start=0`;

  const { data } = await axios.get(url, {
    headers: {
      accept: "application/vnd.linkedin.normalized+json+2.1",
      "csrf-token": CSRF_TOKEN,
      "x-li-lang": "en_US",
      "x-li-track":
        '{"clientVersion":"1.2.3179","osName":"web","timezoneOffset":-7,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
      "x-restli-protocol-version": "2.0.0",
    },
    withCredentials: true,
  });

  if (data.included.length > 0) {
    const connections = data.included.filter(
      (el: { $type: string }) =>
        el.$type === "com.linkedin.voyager.identity.shared.MiniProfile"
    );
    trueCount = connections.map(
      (el: { publicIdentifier: any }) => el.publicIdentifier
    ).length;
  }
  return { htmlCount, trueCount };
};

// Listen for messages from extension popup
chrome.runtime.onMessage.addListener((req, sender, sendRes) => {
  if (req.type === "CONNECTION_COUNT") {
    getConnectionCount().then(sendRes);
  } else if (req.type === "DOWNLOAD") {
    // todo)) download connections as csv or json or whatever
  }

  return true;
});
