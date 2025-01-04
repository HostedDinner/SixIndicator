// interface IHostNamesEntry {

// }

export interface IIpInfo {
  url: string;
  hostname: string;
  isCached: boolean;
  ip: string;
  ipVersion: string; // TODO string enum
}

export interface ICounterIpInfo extends IIpInfo {
  isProxied: boolean;
  secureMode: string; // TODO String Enum
  isMain: boolean;
  counter: number;
}

export interface ITabStorage {
  hostnames: Record<string, Record<string, ICounterIpInfo>>;
  main: IIpInfo;
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
