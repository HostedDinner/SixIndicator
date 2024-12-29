const ICONDIR = "../icons/";

//browser chrome fix
const browser = window.browser || window.chrome;

/**
 * Builds the table of elements
 *
 * @param {HTMLTableElement} table
 * @param {TabStorage} tabStorage
 * @returns {Boolean}
 */
function buildTable(table, tabStorage) {
  let atLeastOne = false;

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
 *
 * @param {HTMLTableRowElement} row
 * @param {CounterIpInfo} counterIpInfo
 * @returns {void}
 */
function buildRow(row, counterIpInfo) {
  row.insertCell(0).appendChild(getIpVersionElement(counterIpInfo.ipVersion));
  row.insertCell(1).appendChild(getSecureElement(counterIpInfo));
  row.insertCell(2).appendChild(getCounterElement(counterIpInfo));
  row.insertCell(3).appendChild(getHostNameElement(counterIpInfo));
  row.insertCell(4).appendChild(getIpElement(counterIpInfo));
}

/**
 * Constructs the &lt;img&gt; element
 *
 * @param {String} ipVersion
 * @returns {HTMLElement}
 */
function getIpVersionElement(ipVersion) {
  let newImageHTMLElement = document.createElement("img");
  let svgPath = [ICONDIR, ipVersion, ".svg"].join("");

  newImageHTMLElement.src = svgPath;
  newImageHTMLElement.width = 18;
  newImageHTMLElement.height = 18;
  newImageHTMLElement.title = getIpVersionHelpText(ipVersion);

  return newImageHTMLElement;
}

/**
 * Gets the Help (title) text for the IP Image Element
 *
 * @param {String} ipVersion
 * @returns {String}
 */
function getIpVersionHelpText(ipVersion) {
  let helpText = "Unknown";
  switch (ipVersion) {
    case "v4":
      helpText = browser.i18n.getMessage("popupTooltipLoadedIpVersion", "IPv4");
      break;
    case "v6":
      helpText = browser.i18n.getMessage("popupTooltipLoadedIpVersion", "IPv6");
      break;
    case "v6to4":
      helpText = browser.i18n.getMessage("popupTooltipLoadedNAT64");
      break;
    case "cache":
      helpText = browser.i18n.getMessage("popupTooltipLoadedCache");
      break;
  }
  return helpText;
}

/**
 * Constructs the counter element
 *
 * @param {CounterIpInfo} counterIpInfo
 * @returns {HTMLElement}
 */
function getCounterElement(counterIpInfo) {
  return document.createTextNode("(" + counterIpInfo.counter + ")");
}

/**
 * Constructs the Secure element
 *
 * @param {CounterIpInfo} counterIpInfo
 * @returns {HTMLElement}
 */
function getSecureElement(counterIpInfo) {
  let newImageHTMLElement = document.createElement("img");
  let svgPath = [ICONDIR, counterIpInfo.secureMode, ".svg"].join("");

  newImageHTMLElement.src = svgPath;
  newImageHTMLElement.width = 18;
  newImageHTMLElement.height = 18;
  newImageHTMLElement.title = getSecureHelpText(counterIpInfo.secureMode);

  return newImageHTMLElement;
}

/**
 * Gets the Help (title) text for the Secure Image Element
 *
 * @param {String} secureMode
 * @returns {String}
 */
function getSecureHelpText(secureMode) {
  let helpText = "Unknown";
  switch (secureMode) {
    case "secure":
      helpText = browser.i18n.getMessage("popupTooltipSecureConnection");
      break;
    case "unsecure":
      helpText = browser.i18n.getMessage("popupTooltipUnsecureConnection");
      break;
    case "mixed":
      helpText = browser.i18n.getMessage("popupTooltipMixedConnection");
      break;
  }
  return helpText;
}

/*
 * Constructs the hostname element
 *
 * @param {CounterIpInfo} counterIpInfo
 * @returns {HTMLElement}
 */
function getHostNameElement(counterIpInfo) {
  let newSpanHTMLElement = document.createElement("span");

  newSpanHTMLElement.appendChild(
    document.createTextNode(counterIpInfo.hostname)
  );
  if (counterIpInfo.isMain) newSpanHTMLElement.classList.add("mainItem");

  if (counterIpInfo.isProxied) {
    newSpanHTMLElement.classList.add("proxyItem");
    newSpanHTMLElement.title = browser.i18n.getMessage(
      "popupTooltipLoadedProxy"
    );
  }

  return newSpanHTMLElement;
}

/**
 * Constructs the ip element
 *
 * @param {CounterIpInfo} counterIpInfo
 * @returns {HTMLElement}
 */
function getIpElement(counterIpInfo) {
  let newSpanElement = document.createElement("span");
  newSpanElement.appendChild(document.createTextNode(counterIpInfo.ip));

  if (
    navigator.clipboard !== undefined &&
    "function" === typeof navigator.clipboard.writeText
  ) {
    newSpanElement.title = browser.i18n.getMessage("popupTooltipCopyIp");
    newSpanElement.dataset.ip = counterIpInfo.ip;
    newSpanElement.classList.add("copyableItem");
    newSpanElement.addEventListener("click", function () {
      navigator.clipboard.writeText(this.dataset.ip);
    });
  }

  return newSpanElement;
}

/**
 * Deletes all rows from the table
 *
 * @param {HTMLTableElement } table
 * @returns {void}
 */
function deleteAllRows(table) {
  let rowCount = table.rows.length;
  for (let i = rowCount - 1; i >= 0; i--) {
    table.deleteRow(i);
  }
}

/**
 * Sets the default text on the popup (localized)
 *
 * @returns {void}
 */
function setDefaultText() {
  document.getElementById("note").textContent =
    browser.i18n.getMessage("popupDefaultText");
}

document.addEventListener("DOMContentLoaded", () => {
  setDefaultText();

  let backgroundConnectionPort = browser.runtime.connect();

  backgroundConnectionPort.onMessage.addListener((message) => {
    let action = message.action;
    if (action !== undefined) {
      switch (action) {
        case "updateContent":
          let atLeastOne = buildTable(
            document.getElementById("contentTable"),
            message.tabStorage
          );
          if (atLeastOne)
            document.getElementById("note").style.display = "none";
          break;
      }
    }
  });

  if (backgroundConnectionPort !== null) {
    backgroundConnectionPort.postMessage({ action: "requestContent" });
  }
});
