import type {
  ITabStorage,
  IIpInfo,
  PortMessage,
  UpdateContentPortMessage,
  WebResponseCacheDetailsWithProxyInfo,
} from "./types/types";

// TODO port to browser Namespace and Promises with kind of fallback/or polyfill for chrome
//browser chrome fix
//const browser = window.browser || window.chrome;
const _browser = chrome;

// variables / consts
const debugLog = false;

const requestFilter = {
  urls: ["<all_urls>"],
};

enum IpVersion {
  IPV4 = "v4",
  IPV6 = "v6",
  IPV6TO4 = "v6to4",
  UNKN = "unknown",
  CACHE = "cache",
}

enum SecureMode {
  SECURE = "secure",
  UNSECURE = "unsecure",
  MIXED = "mixed",
}

const ICONDIR = "icons/";

const storageMap: Partial<Record<number, ITabStorage>> = {};
let popupConnectionPort: chrome.runtime.Port | null = null;
let popupConnectionTabId: number | null = null;

// types

class TabStorage implements ITabStorage {
  entries: IIpInfo[];
  mainIp?: string;
  mainHostname?: string;

  constructor() {
    this.entries = [];
  }
}

class IpInfo implements IIpInfo {
  hostname: string;
  ip: string;
  ipVersion: string;
  isCached: boolean;
  isProxied: boolean;
  secureMode: string;
  isMain: boolean;
  counter: number;

  constructor(
    hostname: string,
    ip: string,
    isCached: boolean,
    isProxied: boolean,
    secureMode: string,
    isMain: boolean
  ) {
    this.hostname = hostname;
    if (ip === "") {
      this.ip = "";
      this.ipVersion = isCached ? IpVersion.CACHE : IpVersion.UNKN;
    } else {
      this.ip = ip;
      this.ipVersion = getIPVersion(ip);
    }

    this.isCached = isCached;
    this.isProxied = isProxied;
    this.secureMode = secureMode;
    this.isMain = isMain;
    this.counter = 0;
  }
}

// functions

/**
 * Gets the active Tab ID as promise.
 */
function queryActiveTabId() {
  return new Promise<number>((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 1 && tabs[0].id) {
        resolve(tabs[0].id);
      } else {
        reject("Found " + tabs.length + " Tabs, instead of 1");
      }
    });
  });
}

function updatePageAction(tabId: number) {
  if (tabId === -1) {
    return;
  }

  const tabStorage = storageMap[tabId];
  const mainHostname = tabStorage?.mainHostname;
  const mainIp = tabStorage?.mainIp;

  if (tabStorage && mainHostname && mainIp) {
    const ipInfo = tabStorage.entries.find((e) => {
      return e.hostname === mainHostname && e.ip === mainIp;
    });

    if (ipInfo) {
      const printedIp = ipInfo.isCached
        ? _browser.i18n.getMessage("pageActionCached")
        : ipInfo.ip;
      const title = _browser.i18n.getMessage("pageActionTooltip", [
        ipInfo.hostname,
        printedIp,
      ]);

      const path = [ICONDIR, ipInfo.ipVersion, ".svg"].join("");

      // send Message to information popup (if its connected at the moment)
      if (popupConnectionPort !== null && tabId === popupConnectionTabId) {
        const message: UpdateContentPortMessage = {
          action: "updateContent",
          tabStorage,
        };
        popupConnectionPort.postMessage(message);
      }

      // sets the PageAction title and icon accordingly
      _browser.pageAction.setTitle({
        tabId,
        title,
      });
      _browser.pageAction.setIcon({
        tabId,
        path,
      });
    }
  }

  // show the icon
  // if the store was empty (e.g. new page) show the default icon
  _browser.pageAction.show(tabId);
}

/**
 * Determines, if the given IP address is IPv4, Ipv6 or not determinable
 */
function getIPVersion(ipAddress: string) {
  if (ipAddress.indexOf(":") !== -1) {
    if (ipAddress.startsWith("64:ff9b::")) {
      // TODO make this configurable
      return IpVersion.IPV6TO4;
    } else {
      return IpVersion.IPV6;
    }
  } else if (ipAddress.indexOf(".") !== -1) {
    return IpVersion.IPV4;
  }

  return IpVersion.UNKN;
}

/**
 * Determines, if the given protocol is a secure protocol (whitelist)
 */
function getSecureMode(protocol: string) {
  if (
    protocol === "https:" ||
    protocol === "ftps:" ||
    protocol === "ssh:" ||
    protocol === "ircs:" ||
    protocol === "wss:"
  ) {
    return SecureMode.SECURE;
  }

  return SecureMode.UNSECURE;
}

/**
 * Gets the tabStorage object of the specified tabId or creates it, if not found
 */
function getOrCreateTabStorage(tabId: number) {
  let tabStorage = storageMap[tabId];
  if (tabStorage === undefined) {
    tabStorage = new TabStorage();
    storageMap[tabId] = tabStorage;
  }

  return tabStorage;
}

// listeners

/**
 * (Debugging only) Called when a request is beeing send.
 */
if (debugLog) {
  _browser.webRequest.onBeforeRequest.addListener((details) => {
    console.log(
      "[" +
        details.tabId +
        "] " +
        details.requestId +
        ": Request started " +
        details.url
    );
  }, requestFilter);
}

/*
 * called for every request
 */
_browser.webRequest.onResponseStarted.addListener((details) => {
  if (details.tabId === -1) {
    return;
  }

  const urlObj = new URL(details.url);

  const tabId = details.tabId;
  const hostname = urlObj.hostname;
  const ip = details.ip || "";
  const requestType = details.type;
  const isCached = details.fromCache;
  const isMain = requestType === "main_frame";

  // Fix for missing type
  const detailsEx = details as WebResponseCacheDetailsWithProxyInfo;
  const isProxied =
    detailsEx.proxyInfo !== undefined &&
    detailsEx.proxyInfo !== null &&
    detailsEx.proxyInfo.type !== "direct";
  const secureMode = getSecureMode(urlObj.protocol);

  if (debugLog)
    console.log(
      "[" +
        tabId +
        "] " +
        details.requestId +
        ": Response started " +
        details.url
    );

  // delete associated data, as we made a new main request
  if (isMain) {
    delete storageMap[tabId];
  }

  const tabStorage = getOrCreateTabStorage(tabId);

  // check if this is the main request of this frame
  // if so, remember the infos about the IP/Host
  if (isMain) {
    tabStorage.mainHostname = hostname;
    tabStorage.mainIp = ip;
  }

  let ipInfo = tabStorage.entries.find((e) => {
    return e.hostname === hostname && e.ip === ip;
  });

  if (ipInfo === undefined) {
    ipInfo = new IpInfo(hostname, ip, isCached, isProxied, secureMode, isMain);
    tabStorage.entries.push(ipInfo);
  }

  ipInfo.counter++;
  if (ipInfo.isCached && !isCached) {
    ipInfo.isCached = false;
  }

  if (!ipInfo.isProxied && isProxied) {
    ipInfo.isProxied = true;
  }

  if (ipInfo.secureMode !== secureMode) {
    ipInfo.secureMode = SecureMode.MIXED;
  }

  updatePageAction(tabId);
}, requestFilter);

/*
 * Called, when a (new) tab gets activated
 * keep showing the icon on every tab and not only on tabs wich have done at least one request
 * in the case of a new tab the '?' is shown
 */
_browser.tabs.onActivated.addListener((activeInfo) => {
  updatePageAction(activeInfo.tabId);
});

/**
 * Called, when a tab is created.
 * As we probably do not have any data about this tab, just show the icon. (unknown state)
 */
_browser.tabs.onCreated.addListener((tabInfo) => {
  if (tabInfo.id) {
    _browser.pageAction.show(tabInfo.id);
  }
});

/*
 * called when a tab is moved around
 * Force showing the icon again, sometimes it gets destroyed (bug?)
 */
_browser.tabs.onAttached.addListener((tabId, attachInfo) => {
  _browser.pageAction.show(tabId);
});

/**
 * called when a tab is removed. We clean up our data.
 */
_browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  delete storageMap[tabId];
});

/*
 * Called when a tab is updated.
 */
_browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
  if (changeInfo.status === "complete") {
    _browser.pageAction.show(tabId);
  }

  // clean up our data, when a tab itself cleans up
  if (changeInfo.discarded && tabInfo.id) {
    delete storageMap[tabInfo.id];
  }
});

/*
 * Handles the connection from our information page
 * It will connect, if the user clicks the page action and will diconnect when the popup is closed
 */
_browser.runtime.onConnect.addListener((port) => {
  popupConnectionPort = port;
  if (debugLog) console.log("Page has connected");

  popupConnectionPort.onMessage.addListener((message: PortMessage) => {
    const action = message.action;
    switch (action) {
      case "requestContent":
        queryActiveTabId().then((tabId) => {
          popupConnectionTabId = tabId;
          updatePageAction(popupConnectionTabId);
        });
        break;
    }
  });

  popupConnectionPort.onDisconnect.addListener((port) => {
    popupConnectionPort = null;
    popupConnectionTabId = null;
    if (debugLog) console.log("Page has disconnected");
  });
});
