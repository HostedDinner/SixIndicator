
const ICONDIR = '../icons/';

//browser chrome fix
const browser = window.browser || window.chrome;

/**
 * Builds the table of elements
 * 
 * @param {HTMLTableElement} table
 * @param {TabStorage} tabStorage
 * @returns {Boolean}
 */
function buildTable(table, tabStorage){
    
    let atLeastOne = false;
    
    deleteAllRows(table);
    
    for(let hostnameProps in tabStorage.hostnames) {
        if(tabStorage.hostnames.hasOwnProperty(hostnameProps)) {
            let ipsForHostname = tabStorage.hostnames[hostnameProps];
            
            for(var ipsProps in ipsForHostname) {
                if(ipsForHostname.hasOwnProperty(ipsProps)){
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
function buildRow(row, counterIpInfo){
    row.insertCell(0).appendChild(getIpVersionImg(counterIpInfo.ipVersion));
    row.insertCell(1).innerHTML = '(' + counterIpInfo.counter + ')';
    row.insertCell(2).appendChild(getHostNameSpan(counterIpInfo));
    row.insertCell(3).innerHTML = counterIpInfo.ip;
}

/**
 * Constructs the &lt;img&gt; element
 * 
 * @param {String} ipVersion
 * @returns {HTMLElement}
 */
function getIpVersionImg(ipVersion){
    let newImageHTMLElement = document.createElement('img');
    let pathSVG = [ICONDIR, ipVersion, '.svg'].join('');
    
    newImageHTMLElement.src = pathSVG;
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
function getIpVersionHelpText(ipVersion){
    let helpText = 'Unknown';
    switch(ipVersion){
        case 'v4': helpText = browser.i18n.getMessage('popupTooltipLoadedIpVersion', 'IPv4'); break;
        case 'v6': helpText = browser.i18n.getMessage('popupTooltipLoadedIpVersion', 'IPv6'); break;
        case 'cache': helpText = browser.i18n.getMessage('popupTooltipLoadedCache'); break;
    }
    return helpText;
}

/*
 * Constructs the hostname element
 * 
 * @param {CounterIpInfo} counterIpInfo
 * @returns {HTMLElement}
 */
function getHostNameSpan(counterIpInfo){
    let newSpanHTMLElement = document.createElement('span');
    
    newSpanHTMLElement.innerHTML = counterIpInfo.hostname;
    if(counterIpInfo.isMain)
        newSpanHTMLElement.classList.add('mainItem');
    
    if(counterIpInfo.isProxied){
        newSpanHTMLElement.classList.add('proxyItem');
        newSpanHTMLElement.title = browser.i18n.getMessage('popupTooltipLoadedProxy');
    }
    
    return newSpanHTMLElement;
}



/**
 * Deletes all rows from the table
 * 
 * @param {HTMLTableElement } table
 * @returns {void}
 */
function deleteAllRows(table){
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
function setDefaultText(){
    document.getElementById('note').innerHTML = browser.i18n.getMessage('popupDefaultText');
}

document.addEventListener('DOMContentLoaded', () =>
{
    setDefaultText();
    
    let backgroundConnectionPort = browser.runtime.connect();

    backgroundConnectionPort.onMessage.addListener((message) => {
        let action = message.action;
        if(action !== undefined){
            switch(action){
                case 'updateContent':
                    let atLeastOne = buildTable(document.getElementById('contentTable'), message.tabStorage);
                    if(atLeastOne)
                        document.getElementById('note').style.display = 'none';
                    break;
            }
        }
    });


    if(backgroundConnectionPort !== null){
        backgroundConnectionPort.postMessage({action: 'requestContent'});
    }
});
