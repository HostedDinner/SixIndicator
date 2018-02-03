
const ICONDIR = '../icons/';

/**
 * Builds the table of elements
 * 
 * @param {type} tableElement
 * @param {TabStorage} tabStorage
 * @returns {Boolean}
 */
function buildTable(tableElement, tabStorage){
    
    let atLeastOne = false;
    
    deleteAllRows(tableElement);
    
    for (var [hostname, ipsForHostname] of tabStorage.hostnames){
        for(var [ip, counterIpInfo] of ipsForHostname){
            buildRow(tableElement, counterIpInfo);
            atLeastOne = true;
        }
    }
    
    return atLeastOne;
}

/**
 * Builds one row
 * 
 * @param {type} tableElement
 * @param {CounterIpInfo} counterIpInfo
 * @returns {void}
 */
function buildRow(tableElement, counterIpInfo){
    
    let row = tableElement.insertRow(-1);
    
    row.insertCell(0).innerHTML = getIpVersionImageTag(counterIpInfo.ipVersion);
    row.insertCell(1).innerHTML = '(' + counterIpInfo.counter + ')';
    row.insertCell(2).innerHTML = getHostNameTag(counterIpInfo.hostname, counterIpInfo.isMain);
    row.insertCell(3).innerHTML = counterIpInfo.ip;
}

/**
 * Constructs the &lt;img&gt; tag
 * 
 * @param {String} ipVersion
 * @returns {String}
 */
function getIpVersionImageTag(ipVersion){
    
    let pathSVG = [ICONDIR, ipVersion, '.svg'].join('');
    
    return '<img src="' + pathSVG + '" width="18" height="18">';
}

function getHostNameTag(hostName, isMain){
    if(isMain)
        return ['<span class="mainItem">', hostName, '</span>'].join('');
    else
        return hostName;
}



/**
 * Deletes all rows from the table
 * 
 * @param {type} tableElement
 * @returns {void}
 */
function deleteAllRows(tableElement) {
    let rowCount = tableElement.rows.length;
    for (let i = rowCount - 1; i >= 0; i--) {
        tableElement.deleteRow(i);
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
