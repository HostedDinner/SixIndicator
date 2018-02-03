
// variables / consts

//browser chrome fix
const browser = window.browser || window.chrome;

const debugLog = false;

const requestFilter = {
  urls: ["<all_urls>"]
};

const IPVERSIONS = {
    IPV4: 'v4',
    IPV6: 'v6',
    UNKN: 'unknown',
    CACHE: 'cache'
};

const ICONDIR = 'icons/';

let storageMap = new Map();
let activeTabId = null;
let popupConnectionPort = null;


// types

function TabStorage(){
    this.hostnames = new Map();
    this.main = new IpInfo('', '', false);
}

function IpInfo(url, ip, isCached){
    this.url = url;
    this.hostname = url !== '' ? new URL(url).hostname : '';
    this.isCached = isCached;
    if(ip === undefined || ip === null || ip === ''){
        this.ip = '';
        this.ipVersion = isCached ? IPVERSIONS.CACHE : IPVERSIONS.UNKN;
    }else{
        this.ip = ip;
        this.ipVersion = getIPVersion(ip);
    }
}

function CounterIpInfo(hostname, ip, isCached, isMain){
    this.hostname = hostname;
    this.isCached = isCached;
    this.isMain = isMain;
    if(ip === undefined || ip === null || ip === ''){
        this.ip = '';
        this.ipVersion = isCached ? IPVERSIONS.CACHE : IPVERSIONS.UNKN;
    }else{
        this.ip = ip;
        this.ipVersion = getIPVersion(ip);
    }
    this.counter = 1;
    /*this.incrementCounter = (isCached) => {
        this.counter++;
        if(this.isCached && !isCached){
            this.isCached = false;
        }
    };*/
}



// functions

function updateActiveTabPageAction(){
    updatePageAction(activeTabId);
}

function updatePageAction(tabId){
    if(tabId !== -1){
        let tabStorage = storageMap.get(tabId);
        if(tabStorage !== undefined){
            
            let title = '';
            if(tabStorage.main.isCached){
                title = [tabStorage.main.hostname, ' (Cached)'].join('');
            }else{
                title = [tabStorage.main.hostname, ' (', tabStorage.main.ip, ')'].join('');
            }
            let pathSVG = [ICONDIR, tabStorage.main.ipVersion, '.svg'].join('');

            // send Message to information popup (if its connected at the moment)
            if(popupConnectionPort !== null && tabId === activeTabId)
                popupConnectionPort.postMessage({action: 'updateContent', tabStorage});

            // sets the PageAction title and icon accordingly
            browser.pageAction.setTitle({
                tabId,
                title
            });
            browser.pageAction.setIcon({
                tabId,
                path: {
                    '19': pathSVG,
                    '38': pathSVG
                }
            });
        }
        
        // show the icon
        // if the sore was empty (e.g. new page) show the default icon
        browser.pageAction.show(tabId);
    }
}

/**
 * Determines, if the given IP address is IPv4, Ipv6 or not determinable
 * @param {String} ipAddress
 * @returns {String}
 */
function getIPVersion(ipAddress){
    let version = IPVERSIONS.UNKN;
    
    if(ipAddress !== null){
        if(ipAddress.indexOf(':') !== -1){
            version = IPVERSIONS.IPV6;
        }else if(ipAddress.indexOf('.') !== -1){
            version = IPVERSIONS.IPV4;
        }
    }
    
    return version;
}


// listeners

/*
 * called for every request
 */
browser.webRequest.onResponseStarted.addListener((details) => {
    let tabId = details.tabId;
    let ip = details.ip || '';
    let host = new URL(details.url).hostname;
    let url = details.url;
    let requestType = details.type;
    let isCached = details.fromCache;
    let isMain = requestType === 'main_frame';
    
    // delete associated data, as we made a new main request
    if(isMain){
        storageMap.delete(tabId);
    }
    
    
    let tabStorage = storageMap.get(tabId);
    if(tabStorage === undefined){
        tabStorage = new TabStorage();
        storageMap.set(tabId, tabStorage);
    }
    
    // check if this is the main request of this frame
    // if so, remember the infos about the IP/Host
    if(isMain){
        let mainIpInfo = new IpInfo(url, ip, isCached);
        tabStorage.main = mainIpInfo;
    }
    
    
    let ipsForHostname = tabStorage.hostnames.get(host);
    if(ipsForHostname === undefined){
        ipsForHostname = new Map();
        tabStorage.hostnames.set(host, ipsForHostname);
    }
    
    let counterIpInfo = ipsForHostname.get(ip);
    if(counterIpInfo === undefined){
        counterIpInfo = new CounterIpInfo(host, ip, isCached, isMain);
    }else{
        counterIpInfo.counter++;
        if(counterIpInfo.isCached && !isCached){
            counterIpInfo.isCached = false;
        }
        //counterIpInfo.incrementCounter(isCached);
    }
    ipsForHostname.set(ip, counterIpInfo);

    updatePageAction(tabId);
    
}, requestFilter);


/*
 * Called, when a (new) tab gets activated
 * keep showing the icon on every tab and not only on tabs wich have done at least one request
 * in the case of a new tab the "?" is shown
 */
browser.tabs.onActivated.addListener((activeInfo) => {
    activeTabId = activeInfo.tabId;
    updatePageAction(activeInfo.tabId);
});

/**
 * Called, when a tab is created.
 * As we probably do not have any data about this tab, just show the icon. (unknown state)
 */
browser.tabs.onCreated.addListener((tabInfo) => {
    browser.pageAction.show(tabInfo.id);
});


/*
 * called when a tab is moved around
 * Force showing the icon again, sometimes it gets destroyed (bug?)
 */
browser.tabs.onAttached.addListener((tabId, attachInfo) => {
    browser.pageAction.show(tabId);
});


/*
 * Called when a tab is updated.
 */
browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
    if(changeInfo.status !== undefined && changeInfo.status === 'complete')
        browser.pageAction.show(tabId);
});


/*
 * Handles the connection from our information page
 * It will connect, if the user clicks the page action and will diconnect when the popup is closed
 */
browser.runtime.onConnect.addListener((port) => {
    popupConnectionPort = port;
    if(debugLog)
        console.log('Page has connected');
    
    popupConnectionPort.onMessage.addListener((message) => {
        
        // dispatch message
        // for example when getting somthing like message.action = "getXXX" or "requestContent"
        
        let action = message.action;
        if(action !== undefined){
            switch(action){
                case 'requestContent':
                    updateActiveTabPageAction();
                    break;
            }
        }
    });
    
    
    popupConnectionPort.onDisconnect.addListener((port) => {
        popupConnectionPort = null;
        if(debugLog)
            console.log('Page has disconnected');
    });
});