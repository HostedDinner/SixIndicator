export interface IIpInfo {
  hostname: string;
  ip: string;
  ipVersion: string; // actually string enum, but as we have only interfaces here, we cant define it really
  isCached: boolean;
  isProxied: boolean;
  secureMode: string; // actually string enum, but as we have only interfaces here, we cant define it really
  isMain: boolean;
  counter: number;
}

export interface ITabStorage {
  entries: IIpInfo[];
  mainIp?: string;
  mainHostname?: string;
}

export type UpdateContentPortMessage = {
  action: "updateContent";
  tabId: number;
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
