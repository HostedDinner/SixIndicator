import type {
  ITabStorage,
  IIpInfo,
  PortMessage,
  UpdateContentPortMessage,
  WebResponseCacheDetailsWithProxyInfo,
  SessionStorageTabData,
} from "./types/types";

// TODO port to browser Namespace and Promises with kind of fallback/or polyfill for chrome
//browser chrome fix
//const browser = window.browser || window.chrome;
const _browser = chrome;

const requestFilter = {
  urls: ["<all_urls>"],
};

const IpVersion = {
  IPV4: "v4",
  IPV6: "v6",
  IPV6TO4: "v6to4",
  UNKN: "unknown",
  CACHE: "cache",
} as const;

const SecureMode = {
  SECURE: "secure",
  UNSECURE: "unsecure",
  MIXED: "mixed",
} as const;

const ICONDIR = "icons/";

// FIXME: this will not work, when service worker shuts down
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
async function queryActiveTabId() {
  const activeTabs = await _browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (activeTabs.length === 1 && activeTabs[0].id) {
    return activeTabs[0].id;
  }

  throw "Found " + activeTabs.length + " Tabs, instead of 1";
}

async function updatePageAction(tabId: number) {
  if (tabId === -1) {
    return;
  }

  const tabStorage = await getOrCreateTabStorage(tabId);
  const mainHostname = tabStorage.mainHostname;

  let title = null;
  let paths = null;

  if (mainHostname) {
    const mainIp = tabStorage.mainIp ?? "";

    const ipInfo = tabStorage.entries.find((e) => {
      return e.hostname === mainHostname && e.ip === mainIp;
    });

    if (ipInfo) {
      const printedIp = ipInfo.isCached
        ? _browser.i18n.getMessage("pageActionCached")
        : ipInfo.ip;
      title = _browser.i18n.getMessage("pageActionTooltip", [
        ipInfo.hostname,
        printedIp,
      ]);

      //const path = [ICONDIR, ipInfo.ipVersion, ".svg"].join("");
      paths = {
        "48": [ICONDIR, ipInfo.ipVersion, "_48.png"].join(""),
        "128": [ICONDIR, ipInfo.ipVersion, "_128.png"].join(""),
      };

      // send Message to information popup (if its connected at the moment)
      if (popupConnectionPort !== null && tabId === popupConnectionTabId) {
        const message: UpdateContentPortMessage = {
          action: "updateContent",
          tabStorage,
        };
        popupConnectionPort.postMessage(message);
      }
    }
  }

  // sets the PageAction title and icon accordingly
  await updateTitleAndIcon(tabId, title, paths);
}

/**
 * Gets the IPVersion for the given IP address
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
 * Gets the key for looking up the TabStorage in the browser storage
 */
function getTabStorageKey(tabId: number) {
  return `tab--${tabId}`;
}

/**
 * Gets the tabStorage object of the specified tabId or creates it, if not found
 */
async function getOrCreateTabStorage(tabId: number) {
  const key = getTabStorageKey(tabId);

  const filteredTabStorage = (await _browser.storage.session.get(
    key
  )) as SessionStorageTabData;
  let tabStorage = filteredTabStorage[key];

  if (tabStorage === undefined) {
    tabStorage = new TabStorage();
    await _browser.storage.session.set({ [key]: tabStorage });
  }

  return tabStorage;
}

async function updateTabStorage(tabId: number, tabStorage: ITabStorage | null) {
  const key = getTabStorageKey(tabId);

  if (tabStorage == null) {
    await _browser.storage.session.remove(key);
  } else {
    await _browser.storage.session.set({ [key]: tabStorage });
  }
}

async function updateTitleAndIcon(
  tabId: number,
  title: string | null,
  paths: string | { [index: number]: string } | null
) {
  if (tabId === -1) {
    return;
  }

  await _browser.action.setTitle({
    tabId,
    title: title ?? _browser.i18n.getMessage("popupDefaultText"),
  });

  if (!paths) {
    paths = {
      "48": [ICONDIR, "unknown_48.png"].join(""),
      "128": [ICONDIR, "unknown_128.png"].join(""),
    };
  }

  await _browser.action.setIcon({
    tabId,
    path: paths,
  });
}

// listeners

/**
 * Clear TabStorage before the first request happends
 */
_browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
  const tabId = details.tabId;

  if (tabId === -1 || details.frameId !== 0) {
    return;
  }

  // ignore the associated data, as we navigate to a new page
  updateTabStorage(tabId, null);

  // -> do not update yet, the real request will do the update anyway
  //updatePageAction(tabId);
});

/*
 * Called for every request; store the relevant data
 */
_browser.webRequest.onResponseStarted.addListener(async (details) => {
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

  // get the current data
  const tabStorage = await getOrCreateTabStorage(tabId);

  if (isMain) {
    // remember the infos about the IP/Host
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

  await updateTabStorage(tabId, tabStorage);

  updatePageAction(tabId);
}, requestFilter);

/**
 * Called when a tab is removed. We clean up our data.
 */
_browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // no need to await the result
  updateTabStorage(tabId, null);
});

/*
 * Called when a tab is updated.
 */
_browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
  // clean up our data, when a tab itself cleans up
  if (changeInfo.discarded && tabInfo.id) {
    // no need to await the result
    updateTabStorage(tabInfo.id, null);
  }
});

/*
 * Handles the connection from our information page
 * It will connect, if the user clicks the page action and will diconnect when the popup is closed
 */
_browser.runtime.onConnect.addListener((port) => {
  popupConnectionPort = port;

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
  });
});
