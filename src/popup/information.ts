import type {
  ITabStorage,
  IIpInfo,
  PortMessage,
  UpdateContentPortMessage,
  RequestContentPortMessage,
} from "../types/types";

const ICONDIR = "../icons/";

//browser/chrome namespace fix
var _browser: typeof browser | typeof chrome;
if (typeof browser !== "undefined") {
  _browser = browser;
} else if (typeof chrome !== "undefined") {
  _browser = chrome;
} else {
  throw "Neither browser nor chrome namespace is defined";
}

/**
 * Builds the table of elements
 */
function buildTable(table: HTMLTableElement, tabStorage: ITabStorage) {
  let atLeastOne = false;

  if (!table) {
    return atLeastOne;
  }

  deleteAllRows(table);

  for (let i = 0; i < tabStorage.entries.length; i++) {
    const ipInfo = tabStorage.entries[i];

    const newRowElement = table.insertRow(-1);
    buildRow(newRowElement, ipInfo);
    atLeastOne = true;
  }

  return atLeastOne;
}

/**
 * Builds one row
 */
function buildRow(row: HTMLTableRowElement, ipInfo: IIpInfo) {
  row.insertCell(0).appendChild(getIpVersionElement(ipInfo.ipVersion));
  row.insertCell(1).appendChild(getSecureElement(ipInfo));
  row.insertCell(2).appendChild(getCounterElement(ipInfo));
  row.insertCell(3).appendChild(getHostNameElement(ipInfo));
  row.insertCell(4).appendChild(getIpElement(ipInfo));
}

/**
 * Constructs the &lt;img&gt; element
 */
function getIpVersionElement(ipVersion: string) {
  const newImageHTMLElement = document.createElement("img");
  const svgPath = [ICONDIR, ipVersion, ".svg"].join("");

  newImageHTMLElement.src = svgPath;
  newImageHTMLElement.width = 18;
  newImageHTMLElement.height = 18;
  newImageHTMLElement.title = getIpVersionHelpText(ipVersion);

  return newImageHTMLElement;
}

/**
 * Gets the Help (title) text for the IP Image Element
 */
function getIpVersionHelpText(ipVersion: string) {
  switch (ipVersion) {
    case "v4":
      return _browser.i18n.getMessage("popupTooltipLoadedIpVersion", "IPv4");
    case "v6":
      return _browser.i18n.getMessage("popupTooltipLoadedIpVersion", "IPv6");
    case "v6to4":
      return _browser.i18n.getMessage("popupTooltipLoadedNAT64");
    case "cache":
      return _browser.i18n.getMessage("popupTooltipLoadedCache");
    default:
      return "Unknown";
  }
}

/**
 * Constructs the counter element
 */
function getCounterElement(ipInfo: IIpInfo) {
  return document.createTextNode("(" + ipInfo.counter + ")");
}

/**
 * Constructs the Secure element
 */
function getSecureElement(ipInfo: IIpInfo) {
  const newImageHTMLElement = document.createElement("img");
  const svgPath = [ICONDIR, ipInfo.secureMode, ".svg"].join("");

  newImageHTMLElement.src = svgPath;
  newImageHTMLElement.width = 18;
  newImageHTMLElement.height = 18;
  newImageHTMLElement.title = getSecureHelpText(ipInfo.secureMode);

  return newImageHTMLElement;
}

/**
 * Gets the Help (title) text for the Secure Image Element
 */
function getSecureHelpText(secureMode: string) {
  switch (secureMode) {
    case "secure":
      return _browser.i18n.getMessage("popupTooltipSecureConnection");
    case "unsecure":
      return _browser.i18n.getMessage("popupTooltipUnsecureConnection");
    case "mixed":
      return _browser.i18n.getMessage("popupTooltipMixedConnection");
    default:
      return "Unknown";
  }
}

/**
 * Constructs the hostname element
 */
function getHostNameElement(ipInfo: IIpInfo) {
  const newSpanHTMLElement = document.createElement("span");

  newSpanHTMLElement.appendChild(document.createTextNode(ipInfo.hostname));
  if (ipInfo.isMain) {
    newSpanHTMLElement.classList.add("mainItem");
  }

  if (ipInfo.isProxied) {
    newSpanHTMLElement.classList.add("proxyItem");
    newSpanHTMLElement.title = _browser.i18n.getMessage(
      "popupTooltipLoadedProxy"
    );
  }

  return newSpanHTMLElement;
}

/**
 * Constructs the ip element
 */
function getIpElement(ipInfo: IIpInfo) {
  const newSpanElement = document.createElement("span");
  newSpanElement.appendChild(document.createTextNode(ipInfo.ip ?? ""));

  if (
    navigator.clipboard !== undefined &&
    "function" === typeof navigator.clipboard.writeText
  ) {
    newSpanElement.title = _browser.i18n.getMessage("popupTooltipCopyIp");
    newSpanElement.dataset.ip = ipInfo.ip ?? "";
    newSpanElement.classList.add("copyableItem");
    newSpanElement.addEventListener("click", function () {
      navigator.clipboard.writeText(this.dataset.ip!);
    });
  }

  return newSpanElement;
}

/**
 * Deletes all rows from the table
 */
function deleteAllRows(table: HTMLTableElement) {
  const rowCount = table.rows.length;
  for (let i = rowCount - 1; i >= 0; i--) {
    table.deleteRow(i);
  }
}

/**
 * Sets the default text on the popup (localized)
 */
function setDefaultText() {
  const noteElement = document.getElementById("note");
  if (noteElement) {
    noteElement.textContent = _browser.i18n.getMessage("popupDefaultText");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setDefaultText();

  const backgroundConnectionPort = _browser.runtime.connect();

  backgroundConnectionPort.onMessage.addListener((message) => {
    const action = (message as PortMessage).action;
    switch (action) {
      case "updateContent":
        let atLeastOne = false;
        const tabStorage = (message as UpdateContentPortMessage).tabStorage;
        const contentTableElement = document.getElementById("contentTable");
        if (contentTableElement) {
          atLeastOne = buildTable(
            contentTableElement as HTMLTableElement,
            tabStorage
          );
        }
        if (atLeastOne) {
          const noteElement = document.getElementById("note");
          if (noteElement) {
            noteElement.style.display = "none";
          }
        }
        document.body.dataset["tabId"] = String(tabStorage.tabId);
        break;
    }
  });

  if (backgroundConnectionPort !== null) {
    const requestMessage: RequestContentPortMessage = {
      action: "requestContent",
    };
    backgroundConnectionPort.postMessage(requestMessage);
  }
});
