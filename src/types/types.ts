export interface IIpInfo {
  hostname: string;
  ip: string | null;
  ipVersion: string; // actually string enum, but as we have only interfaces here, we cant define it really
  isCached: boolean;
  isProxied: boolean;
  secureMode: string; // actually string enum, but as we have only interfaces here, we cant define it really
  isMain: boolean;
  counter: number;
}

export interface ITabStorage {
  tabId: number;
  entries: IIpInfo[];
  mainIp?: string | null;
  mainHostname?: string;
  preRequestState: boolean;
  lastRenderedTitle?: string | null;
  lastRenderedIpVersion?: string | null;
}

export type UpdateContentPortMessage = {
  action: "updateContent";
  tabStorage: ITabStorage;
};

export type RequestContentPortMessage = {
  action: "requestContent";
};

export type PortMessage = UpdateContentPortMessage | RequestContentPortMessage;

// FIX for missing typedefs
export type WebResponseCacheDetailsWithProxyInfo = {
  proxyInfo?: {
    host: string;
    port: number;
    type: string;
    username: string;
    proxyDNS: string;
    failoverTimeout: number;
  };
};

export type TabStorageCache = {
  [tabId: string]: ITabStorage | undefined;
};
