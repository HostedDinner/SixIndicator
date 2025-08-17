import type {
  ITabStorage,
  IIpInfo,
  PortMessage,
  UpdateContentPortMessage,
  WebResponseCacheDetailsWithProxyInfo,
  TabStorageCache,
} from "./types/types";

//browser/chrome namespace fix
var _browser: typeof browser | typeof chrome;
if (typeof browser !== "undefined") {
  _browser = browser;
} else if (typeof chrome !== "undefined") {
  _browser = chrome;
} else {
  throw "Neither browser nor chrome namespace is defined";
}

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
let popupConnectionPort: browser.runtime.Port | chrome.runtime.Port | null =
  null;
let popupConnectionTabId: number | null = null;

// types

class TabStorage implements ITabStorage {
  tabId: number;
  entries: IIpInfo[];
  mainIp?: string | null;
  mainHostname?: string;
  preRequestState: boolean;
  lastRenderedTitle?: string;
  lastRenderedIpVersion?: string;

  constructor(tabId: number) {
    this.tabId = tabId;
    this.entries = [];
    this.preRequestState = true;
  }
}

class IpInfo implements IIpInfo {
  hostname: string;
  ip: string | null;
  ipVersion: string;
  isCached: boolean;
  isProxied: boolean;
  secureMode: string;
  isMain: boolean;
  counter: number;

  constructor(
    hostname: string,
    ip: string | null,
    isCached: boolean,
    isProxied: boolean,
    secureMode: string,
    isMain: boolean
  ) {
    this.hostname = hostname;
    this.ip = ip;
    if (ip === null) {
      this.ipVersion = isCached ? IpVersion.CACHE : IpVersion.UNKN;
    } else {
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

async function updatePageAction(tabStorage: ITabStorage) {
  const tabId = tabStorage.tabId;
  if (tabId === -1) {
    return;
  }

  const mainHostname = tabStorage.mainHostname;

  let title: string | null | undefined = null;
  let ipVersion: string | null | undefined = null;

  if (mainHostname) {
    const mainIp = tabStorage.mainIp;

    let ipInfo = undefined;

    ipInfo = tabStorage.entries.find((e) => {
      return e.hostname === mainHostname && e.ip === mainIp;
    });

    if (
      !ipInfo ||
      ipInfo.ipVersion === IpVersion.CACHE ||
      ipInfo.ipVersion === IpVersion.UNKN
    ) {
      const ipInfo2 = tabStorage.entries.find((e) => {
        return (
          e.hostname === mainHostname &&
          e.ipVersion !== IpVersion.CACHE &&
          e.ipVersion !== IpVersion.UNKN
        );
      });

      if (ipInfo2) {
        ipInfo = ipInfo2;
      }
    }

    if (ipInfo) {
      const printedIp = ipInfo.isCached
        ? _browser.i18n.getMessage("pageActionCached")
        : ipInfo.ip;
      title = _browser.i18n.getMessage("pageActionTooltip", [
        ipInfo.hostname,
        printedIp ?? "",
      ]);

      ipVersion = ipInfo.ipVersion;

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

  if (title === tabStorage.lastRenderedTitle) {
    title = undefined;
  }

  if (ipVersion === tabStorage.lastRenderedIpVersion) {
    ipVersion = undefined;
  }

  // sets the PageAction title and icon accordingly
  await updateTitleAndIcon(tabId, title, ipVersion);

  let writeBack = false;
  if (title !== tabStorage.lastRenderedTitle) {
    tabStorage.lastRenderedTitle = title;
    writeBack = true;
  }

  if (ipVersion !== tabStorage.lastRenderedIpVersion) {
    tabStorage.lastRenderedIpVersion = ipVersion;
    writeBack = true;
  }

  if (writeBack) {
    writeBackTabStorages();
  }
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
 * TabStorage "Cache" which lives as long as the service worker / background script
 */
let tabStorageCache: TabStorageCache | null = null;

/**
 * Gets and initialize the TabStorageCache
 */
async function getTabStorageCache() {
  // get the TabStorage Cache from the session storage
  if (tabStorageCache == null) {
    tabStorageCache = await _browser.storage.session.get(null);

    if (tabStorageCache == null) {
      tabStorageCache = {};
    }
  }

  return tabStorageCache;
}

/**
 * Gets the key for looking up the TabStorage in the browser storage / tab storage cache
 */
function getTabStorageKey(tabId: number) {
  return `tab--${tabId}`;
}

/**
 * Gets the tabStorage object of the specified tabId or creates it, if not found
 */
async function getOrCreateTabStorage(tabId: number) {
  const tsc = await getTabStorageCache();
  const key = getTabStorageKey(tabId);

  let tabStorage = tsc[key];
  if (tabStorage == undefined) {
    tabStorage = new TabStorage(tabId);
    tsc[key] = tabStorage;
    writeBackTabStorages();
  }

  return tabStorage;
}

/**
 * Clears the tab data from cache / storage
 */
async function clearTabData(tabId: number) {
  const tsc = await getTabStorageCache();
  const key = getTabStorageKey(tabId);

  delete tsc[key];
  writeBackTabStorages();
}

/**
 * Writes back the TabData to session storage (in case the bckground script shuts down)
 */
function writeBackTabStorages() {
  // TODO debounced?
  getTabStorageCache().then((tsc) => {
    _browser.storage.session.set(tsc);
  });
}

async function updateTitleAndIcon(
  tabId: number,
  title: string | null | undefined,
  ipVersion: string | null | undefined
) {
  if (tabId === -1) {
    return;
  }

  if (title !== undefined) {
    title = title ?? _browser.i18n.getMessage("popupDefaultText");
    await _browser.action.setTitle({
      tabId,
      title: title,
    });
  }

  if (ipVersion !== undefined) {
    let paths: { [index: number]: string };
    if (ipVersion === null) {
      paths = {
        "48": [ICONDIR, "unknown_48.png"].join(""),
        "128": [ICONDIR, "unknown_128.png"].join(""),
      };
    } else {
      //path = [ICONDIR, ipVersion, ".svg"].join("");
      paths = {
        "48": [ICONDIR, ipVersion, "_48.png"].join(""),
        "128": [ICONDIR, ipVersion, "_128.png"].join(""),
      };
    }

    await _browser.action.setIcon({
      tabId,
      path: paths,
    });
  }
}

// listeners

/**
 * Clear previous data in beforeNavigate. Set some preliminary data.
 * Browsers will likely not emmit any webRequest-Handler for cached data (or already render data from history)
 */
_browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
  const tabId = details.tabId;
  const frameId = details.frameId;
  if (tabId === -1 || frameId !== 0) {
    return;
  }

  // ignore the associated data, as we navigate to a new page
  await clearTabData(tabId);
  const tabStorage = await getOrCreateTabStorage(tabId);

  // set preliminary data (and only data when history backward/forward)
  if (tabStorage.preRequestState && !tabStorage.mainHostname && details.url) {
    const urlObj = new URL(details.url);
    const hostname = urlObj.hostname;
    const secureMode = getSecureMode(urlObj.protocol);

    tabStorage.mainHostname = hostname;
    tabStorage.mainIp = null;

    const ipInfo = new IpInfo(hostname, null, true, false, secureMode, true);
    ipInfo.counter++;
    tabStorage.entries.push(ipInfo);

    updatePageAction(tabStorage);
  }

  writeBackTabStorages();
});

/**
 * Analyse response data and update the TabStorage
 */
_browser.webRequest.onResponseStarted.addListener(async (details) => {
  const tabId = details.tabId;
  if (tabId === -1) {
    return;
  }

  const urlObj = new URL(details.url);

  const hostname = urlObj.hostname;
  const ip = details.ip || null;
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

    if (tabStorage.preRequestState) {
      // clear the preliminary data
      tabStorage.entries = [];
      tabStorage.preRequestState = false;
    }
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

  writeBackTabStorages();

  updatePageAction(tabStorage);
}, requestFilter);

/**
 * Called when a tab is removed. We clean up our data.
 */
_browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // no need to await the result
  clearTabData(tabId);
});

/*
 * Called when a tab is updated.
 */
_browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
  // clean up our data, when a tab itself cleans up
  if (changeInfo.discarded && tabInfo.id) {
    // no need to await the result
    clearTabData(tabInfo.id);
  }
});

/**
 * At least try to save the data on suspend
 */
_browser.runtime.onSuspend.addListener(() => {
  writeBackTabStorages();
});

/*
 * Handles the connection from our information page
 * It will connect, if the user clicks the page action and will diconnect when the popup is closed
 */
_browser.runtime.onConnect.addListener((port) => {
  popupConnectionPort = port;

  popupConnectionPort.onMessage.addListener((message) => {
    const action = (message as PortMessage).action;
    switch (action) {
      case "requestContent":
        queryActiveTabId().then((tabId) => {
          popupConnectionTabId = tabId;
          getOrCreateTabStorage(tabId).then((ts) => {
            updatePageAction(ts);
          });
        });
        break;
    }
  });

  popupConnectionPort.onDisconnect.addListener((port) => {
    popupConnectionPort = null;
    popupConnectionTabId = null;
  });
});
