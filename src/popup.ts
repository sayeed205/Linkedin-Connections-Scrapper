"use strict";

// Import CSS file
import "./popup.css";

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
      // todo)) will deal with this later
    }
  );

  // Update the buttons and show the progress bar
  const buttonContainer = document.getElementsByClassName(
    "button-container"
  ) as HTMLCollectionOf<HTMLElement>;
  buttonContainer[0].style.display = "none";
  // add progress bar here and update it as the data is being downloaded
  // todo))

  // todo)) add event listener to cancel button to send message to content script to cancel the download

  // todo)) add event listener to content script to update the progress bar

  // todo)) add event listener to content script if the download is cancelled or completed to update the header text and buttons
};

// URL for LinkedIn's Connections page
const connectionPageUrl =
  "https://www.linkedin.com/mynetwork/invite-connect/connections/";

(async function (): Promise<void> {
  // Get all tabs that are currently open in current window and are active
  const tabs: chrome.tabs.Tab[] | undefined = await new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs);
    });
  });

  const activeTab: chrome.tabs.Tab | undefined = tabs?.[0];

  if (!activeTab) {
    return;
  }

  if (activeTab.url?.includes(connectionPageUrl)) {
    // Extension is only active on Connections page
    showButtons();
    showConnectionsCount(activeTab);
    // todo)) add event listener to buttons to send message to content script

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
})();
