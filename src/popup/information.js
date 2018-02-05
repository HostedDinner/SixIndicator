
const ICONDIR = '../icons/';

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
    row.insertCell(2).appendChild(getHostNameSpan(counterIpInfo.hostname, counterIpInfo.isMain));
    row.insertCell(3).innerHTML = counterIpInfo.ip;
}

/**
 * Constructs the &lt;img&gt; element
 * 
 * @param {String} ipVersion
 * @returns {HTMLElement}
 */
function getIpVersionImg(ipVersion){
    let newImageHTMLElement = document.createElement("img");
    let pathSVG = [ICONDIR, ipVersion, '.svg'].join('');
    
    newImageHTMLElement.src = pathSVG;
    newImageHTMLElement.width = 18;
    newImageHTMLElement.height = 18;
    
    return newImageHTMLElement;
}

/*
 * Constructs the hostname element
 * 
 * @param {String} hostName
 * @param {Boolean} isMain
 * @returns {HTMLElement}
 */
function getHostNameSpan(hostName, isMain){
    let newSpanHTMLElement = document.createElement("span");
    
    newSpanHTMLElement.innerHTML = hostName;
    if(isMain)
        newSpanHTMLElement.className = 'mainItem';
    
    return newSpanHTMLElement;
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

document.addEventListener("DOMContentLoaded", () =>
{
    
    //browser chrome fix
    const browser = window.browser || window.chrome;

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
