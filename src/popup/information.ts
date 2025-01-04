import type {
  ITabStorage,
  ICounterIpInfo,
  PortMessage,
  RequestContentPortMessage,
} from "../types/types";

const ICONDIR = "../icons/";

//browser chrome fix
//const browser = window.browser || window.chrome;
const _browser = chrome;

/**
 * Builds the table of elements
 */
function buildTable(table: HTMLTableElement, tabStorage: ITabStorage) {
  let atLeastOne = false;

  if (!table) {
    return atLeastOne;
  }

  deleteAllRows(table);

  for (let hostnameProps in tabStorage.hostnames) {
    if (tabStorage.hostnames.hasOwnProperty(hostnameProps)) {
      let ipsForHostname = tabStorage.hostnames[hostnameProps];

      for (var ipsProps in ipsForHostname) {
        if (ipsForHostname.hasOwnProperty(ipsProps)) {
          let counterIpInfo = ipsForHostname[ipsProps];

          let newRowElement = table.insertRow(-1);
          buildRow(newRowElement, counterIpInfo);
          atLeastOne = true;
        }
      }
    }
  }
  return atLeastOne;
}

/**
 * Builds one row
 */
function buildRow(row: HTMLTableRowElement, counterIpInfo: ICounterIpInfo) {
  row.insertCell(0).appendChild(getIpVersionElement(counterIpInfo.ipVersion));
  row.insertCell(1).appendChild(getSecureElement(counterIpInfo));
  row.insertCell(2).appendChild(getCounterElement(counterIpInfo));
  row.insertCell(3).appendChild(getHostNameElement(counterIpInfo));
  row.insertCell(4).appendChild(getIpElement(counterIpInfo));
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
function getCounterElement(counterIpInfo: ICounterIpInfo) {
  return document.createTextNode("(" + counterIpInfo.counter + ")");
}

/**
 * Constructs the Secure element
 */
function getSecureElement(counterIpInfo: ICounterIpInfo) {
  const newImageHTMLElement = document.createElement("img");
  const svgPath = [ICONDIR, counterIpInfo.secureMode, ".svg"].join("");

  newImageHTMLElement.src = svgPath;
  newImageHTMLElement.width = 18;
  newImageHTMLElement.height = 18;
  newImageHTMLElement.title = getSecureHelpText(counterIpInfo.secureMode);

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
function getHostNameElement(counterIpInfo: ICounterIpInfo) {
  const newSpanHTMLElement = document.createElement("span");

  newSpanHTMLElement.appendChild(
    document.createTextNode(counterIpInfo.hostname)
  );
  if (counterIpInfo.isMain) {
    newSpanHTMLElement.classList.add("mainItem");
  }

  if (counterIpInfo.isProxied) {
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
function getIpElement(counterIpInfo: ICounterIpInfo) {
  const newSpanElement = document.createElement("span");
  newSpanElement.appendChild(document.createTextNode(counterIpInfo.ip));

  if (
    navigator.clipboard !== undefined &&
    "function" === typeof navigator.clipboard.writeText
  ) {
    newSpanElement.title = _browser.i18n.getMessage("popupTooltipCopyIp");
    newSpanElement.dataset.ip = counterIpInfo.ip;
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

  backgroundConnectionPort.onMessage.addListener((message: PortMessage) => {
    const action = message.action;
    switch (action) {
      case "updateContent":
        let atLeastOne = false;
        const contentTableElement = document.getElementById("contentTable");
        if (contentTableElement) {
          atLeastOne = buildTable(
            contentTableElement as HTMLTableElement,
            message.tabStorage
          );
        }
        if (atLeastOne) {
          const noteElement = document.getElementById("note");
          if (noteElement) {
            noteElement.style.display = "none";
          }
        }
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
