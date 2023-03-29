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

import axios from "axios";

// Get CSRF token from cookie
const COOKIE = document.cookie;
const match = COOKIE.match(/JSESSIONID="(.*)"/);
const CSRF_TOKEN = match ? match[1].split('"')[0] : "";

interface ConnectionCount {
  htmlCount: number;
  trueCount: number;
}

interface ConnectionData {
  firstName: string;
  lastName: string;
  email: string;
  linkedinUrl: string;
  phone: string[] | null;
  title: string;
}

// Define a type for the download format (JSON or CSV)
type DownloadFormat = "JSON" | "CSV";

const headers = {
  accept: "application/vnd.linkedin.normalized+json+2.1",
  "csrf-token": CSRF_TOKEN,
  "x-li-lang": "en_US",
  "x-li-track":
    '{"clientVersion":"1.2.3179","osName":"web","timezoneOffset":-7,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
  "x-restli-protocol-version": "2.0.0",
};

// Initialize memberIdentity array which will store public identifiers of all connections
let memberIdentity: string[] = [];

// Set global variable to set cancel status
let cancelStatus = false;

/**
 * This function retrieves the total number of LinkedIn connections for the current user.
 * It first gets an HTML node containing the connection count from the DOM. Then it makes an API call to get
 * actual number of connections. Finally, it returns an object containing both counts.
 *
 * @returns {Promise<ConnectionCount>} A Promise that resolves to a ConnectionCount object with two properties:
 * - htmlCount: The connection count retrieved from the HTML node on LinkedIn's website.
 * - trueCount: The actual number of connections retrieved via API call.
 */
const getConnectionCount = async (): Promise<ConnectionCount> => {
  // Get HTML node containing connection count
  const [HTMLnode] = document.getElementsByClassName(
    "mn-connections__header"
  ) as HTMLCollectionOf<HTMLElement>;

  let htmlCount = 0;

  if (HTMLnode) {
    // Parse HTML node text to get connection count
    htmlCount =
      parseInt(HTMLnode.innerText.split(" ")[0].replace(/,/g, "")) || 0;

    /**
     * If there is no error while parsing then we can proceed further and make api calls using this parsed value,
     */

    // Make API call to get actual number of connections

    const url = `https://www.linkedin.com/voyager/api/relationships/connections?count=${htmlCount}&start=0`;

    try {
      const { data } = await axios.get(url, {
        headers,
        withCredentials: true,
      });

      if (data.included.length > 0) {
        const connections = data.included.filter(
          (el: { $type: string }) =>
            el.$type === "com.linkedin.voyager.identity.shared.MiniProfile"
        );

        /**
         * If there are any connections then we can proceed further and get the publicIdentifier of all members who are connected to current user
         */

        memberIdentity = connections.map(
          (el: { publicIdentifier: string }) => el.publicIdentifier
        );
      }
    } catch (error) {
      // If there is any error while fetching connections details then we can show an alert to user
      alert("Error while fetching connections details");
    }
  }

  // Return an object containing both counts.
  return { htmlCount, trueCount: memberIdentity.length };
};

/**
 * Downloads LinkedIn connections data in either JSON or CSV format.
 * @param type The desired download format.
 */
const downloadConnections = async (type: DownloadFormat): Promise<void> => {
  // Initialize index variable and empty array to store connection data
  let i = 0;
  const connections: ConnectionData[] = [];

  // Define an asynchronous function that loops through each member identity and fetches their profile contact info
  async function loop() {
    // Construct URL using current member identity value
    const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${memberIdentity[i]}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.ProfileContactInfo-11`;

    // Send GET request to LinkedIn API using Axios library, passing headers and credentials options
    const { data } = await axios.get(url, {
      headers,
      withCredentials: true,
    });

    // Filter out unnecessary details from response object and push remaining data into connections array
    connections.push(filterDetails(data));

    // Send message to popup script to update progress bar based on current iteration count
    // this reaching upto 97% how to make it 100%?

    chrome.runtime.sendMessage({
      type: "PROGRESS",
      payload: {
        progress: Math.round(((i + 1) / memberIdentity.length) * 100),
        count: i + 1,
        total: memberIdentity.length,
      },
    });

    /*
     If we have reached the end of our list of member identities:
       - send message to popup script indicating that download is complete 
       - initiate actual file download by calling 'download' function with specified format and connection data as arguments 
     */

    if (i === memberIdentity.length - 1) {
      chrome.runtime.sendMessage({
        type: "DOWNLOAD_COMPLETE",
      });

      download(type, connections);
    }

    // cancel the download if user clicks on cancel button
    if (cancelStatus) {
      console.log("Download cancelled triggered");
      return;
    }

    // Increment index variable and recursively call 'loop' function with a 1 second delay
    i++;
    if (i < memberIdentity.length) {
      setTimeout(loop, 1000);
    }
  }

  // Call the loop function to start fetching connection data
  await loop();
};

/**
 * This function takes in an object of data and returns a ConnectionData object.
 * @param data - The input data to be filtered.
 * @returns A ConnectionData object containing firstName, lastName, email, linkedinUrl,
 * phone number(s), and title of the user.
 */
const filterDetails = (data: any): ConnectionData => {
  // Filter out the user profile from included array using $type property
  let user = data.included.filter(
    (el: { $type: string }) =>
      el.$type === "com.linkedin.voyager.dash.identity.profile.Profile"
  )[0];

  // Format first name with quotes if it contains comma
  const formattedFirstName = user.firstName.includes(",")
    ? `"${user.firstName}"`
    : user.firstName;

  // Format last name with quotes if it contains comma
  const formattedLastName = user.lastName.includes(",")
    ? `"${user.lastName}"`
    : user.lastName;

  // Set email to empty string if not available in the input data
  const emailAddress =
    typeof user.emailAddress?.emailAddress !== "undefined"
      ? user.emailAddress?.emailAddress
      : "";

  // Generate LinkedIn URL using publicIdentifier property of the profile
  const linkedinUrl = `https://www.linkedin.com/in/${user.publicIdentifier}`;

  // Extract phone numbers from phoneNumbers array if available in input data
  const phoneNumberArray =
    typeof user.phoneNumbers !== "undefined" && Array.isArray(user.phoneNumbers)
      ? user.phoneNumbers.map(
          (el: { phoneNumber: { number: string } }) => el.phoneNumber.number
        )
      : null;

  // Format headline/title with quotes if it contains comma
  const formattedTitle = user.headline.includes(",")
    ? `"${user.headline}"`
    : user.headline;

  // Return a ConnectionData object with filtered details
  return {
    firstName: formattedFirstName,
    lastName: formattedLastName,
    email: emailAddress,
    linkedinUrl: linkedinUrl,
    phone: phoneNumberArray,
    title: formattedTitle,
  };
};

/**
 * Downloads a file of type CSV or JSON containing connection data.
 *
 * @param {string} type - The type of file to download (CSV or JSON).
 * @param {ConnectionData[]} connections - An array of objects representing connection data.
 */
const download = (type: DownloadFormat, connections: ConnectionData[]) => {
  // Log the connections array for debugging purposes
  console.log(connections);

  // Declare variables with their respective types and initialize HTMLAnchorElement
  let url: string,
    blob: Blob,
    a = document.createElement("a");

  // Set the filename based on the selected file type
  a.download = `connections.${type.toLowerCase()}`;

  if (type === "CSV") {
    // Download csv

    // Create header row for csv file
    let csv = "First Name,Last Name,Email,LinkedIn URL,Phone,Title";

    // Add each connection as a new row in the csv file
    csv +=
      "\n" +
      connections
        .map((el) => {
          return `${el.firstName},${el.lastName},${el.email},${
            el.linkedinUrl
          },"${el.phone ? el.phone.join(",") : null}",${el.title}`;
        })
        .join("\n");

    // Create blob object from csv content and set url to object URL
    blob = new Blob([csv], { type: "text/csv" });
    url = URL.createObjectURL(blob);
    a.href = url;
  } else if (type === "JSON") {
    // Download json

    // Convert connections array to JSON string
    const json = JSON.stringify(connections, null, 2);

    // Create blob object from JSON content and set url to object URL
    blob = new Blob([json], { type: "application/json" });
    url = URL.createObjectURL(blob);
    a.href = url;
  }

  // Simulate a click on the anchor element to download the file
  a.click();
};

/**
 * This function listens for messages from other parts of the extension or from external sources.
 * It takes a request object, sender object and sendResponse callback as parameters.
 */
chrome.runtime.onMessage.addListener(
  (
    req: { type: string; format?: DownloadFormat },
    sender: chrome.runtime.MessageSender,
    sendRes: (response?: any) => void
  ): boolean => {
    // If the message type is CONNECTION_COUNT
    console.log(req);
    if (req.type === "CONNECTION_COUNT") {
      // Call getConnectionCount() function which returns a Promise that resolves to connection count
      getConnectionCount().then(sendRes);
    }
    // If the message type is DOWNLOAD
    else if (req.type === "DOWNLOAD") {
      cancelStatus = false;
      // Check format property of request object to determine download format
      if (req.format === "CSV") {
        // Call downloadConnections() function with CSV parameter to download connections as CSV file
        downloadConnections("CSV");
      } else if (req.format === "JSON") {
        // Call downloadConnections() function with JSON parameter to download connections as JSON file
        downloadConnections("JSON");
      }
    } else if (req.type === "CANCEL_DOWNLOAD") {
      console.log("Cancel download message received");
      // If the message type is CANCEL_DOWNLOAD, set the cancelDownload variable to true
      cancelStatus = true;
      sendRes();
    }

    return true; // Return true so that sendResponse can be called asynchronously later on.
  }
);
