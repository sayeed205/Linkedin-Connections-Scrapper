"use strict";

// Import CSS file
import "./popup.css";

// Import progress bar js package
import * as ProgressBar from "progressbar.js";
import Line from "progressbar.js/line";

// URL for LinkedIn's Connections page
const connectionPageUrl =
  "https://www.linkedin.com/mynetwork/invite-connect/connections/";

/**
 *  main function.
 * @returns {void}
 */
async function main(): Promise<void> {
  // Get all tabs that are currently open in current window and are active
  const tabs: chrome.tabs.Tab[] | undefined = await new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs);
    });
  });

  const activeTab: chrome.tabs.Tab | undefined = tabs?.[0];

  if (!activeTab) return;
  if (activeTab.url?.includes(connectionPageUrl)) {
    // Extension is only active on Connections page
    showButtons();
    showConnectionsCount(activeTab);

    document.getElementById("json")?.addEventListener("click", () => {
      downloadConnections({ type: "JSON", activeTab });
    });
    document.getElementById("csv")?.addEventListener("click", () => {
      downloadConnections({ type: "CSV", activeTab });
    });
  } else {
    // If not on Connections page, display message and add click event listener to LinkedIn icon
    const header = document.getElementById("header") as HTMLElement;
    header.innerText =
      "Please open the connections page by clicking the linkedin icon.";

    const svg: any = document.getElementsByTagName("svg")[0];

    svg.addEventListener("click", () => {
      chrome.tabs.create({
        url: connectionPageUrl,
      });
    });
  }
}

/**
 * Shows the number of connections on the active tab.
 *
 * @param {chrome.tabs.Tab} activeTab - The currently active tab in Chrome browser.
 */
const showConnectionsCount = (activeTab: chrome.tabs.Tab): void => {
  if (!activeTab.id) return;

  // Send message to content script to get connection count
  chrome.tabs.sendMessage(activeTab.id, { type: "CONNECTION_COUNT" }, (res) => {
    if (!res) return;
    const { htmlCount, trueCount } = res;

    // Update total element with connection count
    const total = document.getElementById("total") as HTMLElement;
    total.innerHTML = `${trueCount} connections`;

    // If HTML count doesn't match true count, add tooltip to explain difference
    if (htmlCount !== trueCount) {
      total.innerHTML += `<div id="tooltip">?<span id="tooltip-text">The number of connections shown in the page is ${htmlCount} but the actual number of connections is ${trueCount}.</span></div>`;
    }
  });
};

/**
 * Shows buttons for user interaction.
 */
const showButtons = (): void => {
  const buttonContainer = document.getElementsByClassName(
    "button-container"
  ) as HTMLCollectionOf<HTMLElement>;

  // Display button container element
  buttonContainer[0].style.display = "block";
};

/**
 * Shows the progress bar.
 * @returns {Line} - The progress bar object.
 */
const showProgressBar = (): Line => {
  const progress = document.getElementsByClassName(
    "progress"
  ) as HTMLCollectionOf<HTMLElement>;
  progress[0].style.display = "block";
  return new ProgressBar.Line("#progress", {
    strokeWidth: 2,
    easing: "easeInOut",
    duration: 1400,
    color: "#0072b1",
    trailColor: "#eee",
    trailWidth: 2,
    svgStyle: {
      width: "100%",
      height: "100%",
      "border-radius": "5px",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    text: {
      style: {
        // Text color.
        // Default: same as linkedin color (value: #0072b1)
        color: "#0072b1",
        position: "absolute",
        right: "0",
        top: "30px",
        padding: 0,
        margin: 0,
        transform: null,
      },
    },
  });
};

/**
 * Shows the cancel button.
 * @returns {void}
 */
const showCancelButton = (): void => {
  const cancelButton = document.getElementById("cancel") as HTMLElement;
  cancelButton.style.display = "block";
};

/**
 * Hides the download buttons.
 * @returns {void}
 */
const hideButtons = (): void => {
  const buttonContainer = document.getElementsByClassName(
    "button-container"
  ) as HTMLCollectionOf<HTMLElement>;
  buttonContainer[0].style.display = "none";
};

/**
 * Hides the cancel button.
 * @returns {void}
 */
const hideCancelButton = (): void => {
  const cancelButton = document.getElementById("cancel") as HTMLElement;
  cancelButton.style.display = "none";
};

/**
 *  Removes the progress bar.
 * @param line - The progress bar object.
 * @returns {void}
 */
const removeProgressBar = (line: Line): void => {
  const progress = document.getElementsByClassName(
    "progress"
  ) as HTMLCollectionOf<HTMLElement>;
  progress[0].style.display = "none";
};

/**
 * Updates the header text and style.
 * @param text  - The text to be displayed.
 * @param style  - The style to be applied.
 */
const updateHeader = (text: string, style: { [key: string]: string }): void => {
  const header = document.getElementById("header") as HTMLElement;
  header.innerText = text;
  for (let key in style) {
    // @ts-ignore
    header.style[key] = style[key];
  }
};

/**
 *  Handles the cancel download event.
 * @param param0  - The tab id and the progress bar object.
 * @returns {void}
 */
const handleCancelDownload = ({
  tabId,
  line,
}: {
  tabId: number;
  line: Line;
}): void => {
  const cancelButton = document.getElementById("cancel") as HTMLElement;
  cancelButton.addEventListener("click", () => {
    chrome.tabs.sendMessage(tabId, { type: "CANCEL_DOWNLOAD" }, (res) => {
      // TODO)) will deal with this later
      console.log(res);
      // hide the cancel button and the progress bar
      hideCancelButton();
      removeProgressBar(line);

      // update the header text
      updateHeader("Download cancelled. Please try again.", {
        color: "red",
        fontWeight: "bold",
        paddingBottom: "10px",
      });
    });
  });
};

/**
 *  Handles the download event.
 * @param param0  - The type of download and the active tab.
 * @returns  {void}
 */
const downloadConnections = ({
  type,
  activeTab,
}: {
  type: string;
  activeTab: chrome.tabs.Tab;
}): void => {
  if (!activeTab.id) return;
  // Send message to content script to get connection data
  chrome.tabs.sendMessage(
    activeTab.id,
    { type: "DOWNLOAD", format: type },
    (res) => {
      // TODO)) will deal with this later
    }
  );

  // show the progress bar and the cancel button
  const line = showProgressBar();
  showCancelButton();

  // hide the buttons
  hideButtons();

  // update the header text
  updateHeader(
    "Downloading... Do not close this tab or the popup. else the download will be cancelled.",
    {
      color: "black",
      fontWeight: "normal",
      paddingBottom: "0px",
    }
  );

  // remove the connection count
  const total = document.getElementById("total") as HTMLElement;
  total.style.display = "none";

  // add event listener to cancel button

  handleCancelDownload({ tabId: activeTab.id, line });

  // listen for download progress
  chrome.runtime.onMessage.addListener(
    (
      req: {
        type: string;
        payload?: { progress: number; count: number; total: number };
      },
      sender,
      sendRes
    ) => {
      if (req.type === "PROGRESS") {
        if (req.payload?.progress) {
          let progress = req.payload?.progress / 100;

          line.animate(progress, {
            step: (state, bar: any) => {
              // TODO)) add proper types for bar as it is svg element as well as has a value method from progress bar package
              bar.setText(
                `${req.payload?.count}/${req.payload?.total} | ${Math.round(
                  progress * 100
                )}%`
              );
            },
          });
        }
      } else if (req.type === "DOWNLOAD_COMPLETE") {
        // update the header text and buttons
      }
    }
  );
};

main();
