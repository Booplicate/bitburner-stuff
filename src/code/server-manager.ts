import { NS } from 'bitburner';

const SERVER_NAME_PREFIX = "pserv";
const SERVER_RAM_REQ = 2**10;
const MIN_BALANCE = 30_000_000;
const HOME_SERVER = "home";

/**
 * Returns current balance
 * @param {NS} ns
*/
function getBalance(ns: NS) {
    return ns.getServerMoneyAvailable(HOME_SERVER);
}


/**
 * Returns all hacked servers recursively
 * @param {NS} ns
 * @param {string} rootServer
*/
export async function getHackedServers(ns: NS, rootServer: string): Promise<string[]> {
    let hackedServers: Set<string> = new Set();
    let serversToScan: string[] = [rootServer];

    function scanServer(root: string) {
        let servers = ns.scan(root);
        for (let serv of servers) {
            if (serv != rootServer && !hackedServers.has(serv) && ns.hasRootAccess(serv)) {
                hackedServers.add(serv);
                serversToScan.push(serv);
            }
        }
    }

    while (serversToScan.length != 0) {
        let rootServ = serversToScan.shift();
        scanServer(rootServ);
        // await ns.sleep(50);
    }

    return Array.from(hackedServers);
}

/**
 * Returns all purchased servers
 * @param {NS} ns
*/
export async function getPurchasedServers(ns: NS): Promise<string[]> {
    return ns.getPurchasedServers();
}

/**
 * Returns all available servers
 * @param {NS} ns
*/
export async function getAvailableServers(ns: NS): Promise<string[]> {
    let hackServers = await getHackedServers(ns, HOME_SERVER);
    let purchServers = await getPurchasedServers(ns);
    return purchServers.concat(hackServers);
}


/**
 * Purchases as many servers as possible while keeping some min balance and
 * buying servers with the required RAM
 * @param {NS} ns
 * @param {number} ramRequired
*/
export async function purchaseServers(ns: NS, ramRequired: number) {
    let ownedServers = await getPurchasedServers(ns);
    const OWNED_SERVERS_LIMIT = ns.getPurchasedServerLimit();

    while (ownedServers.length < OWNED_SERVERS_LIMIT) {
        let balance = getBalance(ns);
        if (balance - ns.getPurchasedServerCost(ramRequired) < MIN_BALANCE) {
            return;
        }

        // let lastServerName = ownedServers[ownedServers.length-1];
        // let lastServerID = lastServerName !== undefined ? Number(lastServerName.split("-", 2)[1]) : -1;
        // lastServerID++;
        // let newServerID = lastServerID;

        // ns.purchaseServer(`${SERVER_NAME_PREFIX}-${newServerID}`, ramRequired);
        ns.purchaseServer(SERVER_NAME_PREFIX, ramRequired);
        // ns.tprint(`${SERVER_NAME_PREFIX}-${newServerID} | ${SERVER_NAME_PREFIX} | ${newServerID} | ${lastServerID} | ${lastServerName} `);

        // await ns.asleep(50);
        ownedServers = ns.getPurchasedServers();
    }
}

/**
 * Upgrades servers with low ram to the new ram, will always buy as many servers as possible
 * even if none were deleted
 * @param {NS} ns
 * @param {number} minRam
 * @param {number} upgradeRam
*/
export async function upgradeServers(ns: NS, minRam: number, upgradeRam: number) {
    for (let serv of await getPurchasedServers(ns)) {
        if (ns.getServerMaxRam(serv) < minRam) {
            if (!ns.deleteServer(serv)) {
                throw new Error(`Failed to delete '${serv}'`);
            }
        }
    }
    await purchaseServers(ns, upgradeRam);
    await fixServerNames(ns);
}

/**
 * Fixes server names
 * @param {NS} ns
*/
export async function fixServerNames(ns: NS) {
    // let i = 0;
    // for (let serv of await getPurchasedServers(ns)) {
    //     ns.renamePurchasedServer(serv, `${SERVER_NAME_PREFIX}-${i}`);
    //     i++;
    // }
}

/**
 * Returns servers stats
 * @param {NS} ns
*/
export async function getServersStats(ns: NS) {
    let rv: Array<Array<string | number>> = [];
    for (let serv of await getPurchasedServers(ns)) {
        let ram = ns.getServerMaxRam(serv);
        rv.push(
            [serv, ram]
        );
    }
    return rv;
}


/** @param {NS} ns */
export async function main(ns: NS) {
    let cmd = ns.args[0];
    if (typeof cmd === "undefined") {
        throw new Error("Missing required argument 'cmd'");
    }

    if (cmd === "buy") {
        await purchaseServers(ns, SERVER_RAM_REQ);
    }
    else if (cmd === "upgrade") {
        await upgradeServers(ns, SERVER_RAM_REQ/2, SERVER_RAM_REQ);
    }
    else if (cmd === "fix") {
        await fixServerNames(ns);
    }
    else if (cmd === "stats") {
        let stats = await getServersStats(ns);
        if (stats.length != 0) {
            for (let item of stats) {
                let msg = `${item[0]}: ${item[1]}`;
                ns.print(msg);
                ns.tprint(msg);
            }
        }
        else {
            let msg = "No purchased servers";
            ns.print(msg);
            ns.tprint(msg);
        }
    }
    else {
        throw new Error(`Unknown 'cmd': '${cmd}'`);
    }
}
