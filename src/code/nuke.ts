import { NS } from 'bitburner';

const HOME_SERVER = "home";
// Dynamic RAM usage calculated to be greater than initial RAM usage on fn: nuke.
// This is probably because you somehow circumvented the static RAM calculation.
// One of these could be the reason:
// * Using eval() to get a reference to a ns function
//   const myScan = eval('ns.scan');
// * Using map access to do the same
//   const myScan = ns['scan'];
// Sorry :(

// const PORT_HACKTOOLS_MAP = new Map(
//     [
//         ["BruteSSH.exe", "brutessh"],
//         ["FTPCrack.exe", "ftpcrack"],
//         ["relaySMTP.exe", "relaysmtp"],
//         ["HTTPWorm.exe", "httpworm"],
//         ["SQLInject.exe", "sqlinject"]
//     ]
// );

/** @param {NS} ns */
export async function main(ns: NS) {
    const PORT_HACKTOOLS_MAP = new Map(
        [
            ["BruteSSH.exe", ns.brutessh],
            ["FTPCrack.exe", ns.ftpcrack],
            ["relaySMTP.exe", ns.relaysmtp],
            ["HTTPWorm.exe", ns.httpworm],
            ["SQLInject.exe", ns.sqlinject]
        ]
    );

    let target: string = ns.args[0].toString();

    ns.tprint(`Trying to hack '${target}' ports...`);
    PORT_HACKTOOLS_MAP.forEach(
        (v, k) => {
            if (ns.fileExists(k, HOME_SERVER)) {
                ns.tprint(`Using '${k}'...`);
                v(target);
            }
        }
    );
    ns.tprint("Done");

    ns.tprint(`Trying to hack '${target}' itself...`);
    ns.nuke(target);
    ns.tprint("Done");

    // ns.tprint(`Trying to backdoor '${target}'...`);
    // let scriptFile = "/code/backdoor.js";
    // if (ns.getScriptRam(scriptFile, HOME_SERVER) <= (ns.getServerMaxRam(target) - ns.getServerUsedRam(target))) {
    //     await ns.scp(scriptFile, target, HOME_SERVER);// wrong typehint, target and dest have been swapped
    //     ns.exec(scriptFile, target, 1);
    // }
    // else {
    //     ns.tprint("Not enough memory for backdoor, skipping")
    // }
    // ns.tprint("Done");
}
