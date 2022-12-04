import { NS } from 'bitburner';
import { getAvailableServers, getHackedServers } from "code/server-manager";

const HOME_SERVER = "home";

const SERVER_MAX_MONEY_MOD = 0.85;
const SERVER_HACK_MOD = 0.5;

const SCRIPT_WEAKEN = "/code/weaken-server.js";
const SCRIPT_GROW = "/code/grow-server.js";
const SCRIPT_HACK = "/code/hack-server.js";


async function getHackableServers(ns: NS, minHackLevel: number = 0, maxHackLevel: number = 100) {
    return (await getHackedServers(ns, HOME_SERVER)).filter(
        (value) => {
            let reqLevel = ns.getServerRequiredHackingLevel(value);
            return ns.getServerMaxMoney(value) != 0 && reqLevel >= minHackLevel && reqLevel <= maxHackLevel;
        }
    );
}

/**
 * Runs a script in up to maxThreads on the given hosts
 * @param {NS} ns
 * @param {string} script
 * @param {string[]} nodes
 * @param {number} maxThreads
 * @param {(string | number | boolean)[]} ...args
*/
async function execInNodes(
    ns: NS,
    script: string,
    nodes: string[],
    maxThreads: number,
    ...args: (string | number | boolean)[]
): Promise<number[]> {
    const scriptRAMRequirement = ns.getScriptRam(script, HOME_SERVER);
    if (scriptRAMRequirement == 0) {
        throw new Error(`Script '${script}' not found at '${HOME_SERVER}'`);

    }

    let runningPIDs: number[] = [];

    for (let serv of nodes) {
        const availableServRAM = ns.getServerMaxRam(serv) - ns.getServerUsedRam(serv);
        // We need at least enough RAM to run 1 thread
        if (availableServRAM >= scriptRAMRequirement) {
            // Copy the script
            let res = await ns.scp(script, serv, HOME_SERVER);
            if (res == false) {
                throw new Error(`Failed to copy '${script}' from '${HOME_SERVER}' to '${serv}'`);
            }
            // Find how many threads we can allow
            const availableServThreads = Math.min(Math.floor(availableServRAM / scriptRAMRequirement), maxThreads);
            if (availableServThreads == 0) {
                continue;
            }
            let new_pid = ns.exec(script, serv, availableServThreads, ...args);
            if (new_pid == 0) {
                throw new Error(
                    `Bad pid '${new_pid}', serv '${serv}', threads ${availableServThreads}, args '${args}', RAM ${availableServRAM}, scriptRAM ${scriptRAMRequirement}, script ${script}`
                );
            }
            runningPIDs.push(new_pid);
            maxThreads -= availableServThreads;

            // If we ran all we needed, we can quit
            if (maxThreads <= 0) {
                break;
            }
        }
    }
    return runningPIDs;
}

/**
 * Runs hacking logic for the given server
 * @param {NS} ns
 * @param {string[]} target
*/
async function processServer(ns: NS, target: string): Promise<number[]> {
    const minServerSecurity = ns.getServerMinSecurityLevel(target);
    const maxServerMoney = ns.getServerMaxMoney(target) * SERVER_MAX_MONEY_MOD;
    let availableServers = await getAvailableServers(ns);
    // availableServers.push("home");

    let serverSecurity = ns.getServerSecurityLevel(target);
    if (serverSecurity > minServerSecurity) {
        const singleThreadSecurityChange = ns.weakenAnalyze(1, 1);
        const requiredThreads = Math.ceil((serverSecurity - minServerSecurity) / singleThreadSecurityChange);
        ns.print(
            `WEAKEN ${target}: ${serverSecurity} -> ${minServerSecurity} (-${((1-minServerSecurity/serverSecurity)*100).toFixed(1)}%) | ${requiredThreads} thread(s)`
        );
        return await execInNodes(ns, SCRIPT_WEAKEN, availableServers, requiredThreads, target);
    }

    let serverMoney = ns.getServerMoneyAvailable(target);
    if (serverMoney < maxServerMoney) {
        const growRatio = maxServerMoney / serverMoney;
        const requiredThreads = Math.ceil(ns.growthAnalyze(target, growRatio));
        ns.print(
            `GROW ${target}: ${serverMoney.toFixed(2)} -> ${maxServerMoney.toFixed(2)} (+${((1-serverMoney/maxServerMoney)*100).toFixed(1)}%) | ${requiredThreads} thread(s)`
        );
        return await execInNodes(ns, SCRIPT_GROW, availableServers, requiredThreads, target);
    }

    const hackMoney = serverMoney * SERVER_HACK_MOD;
    let requiredThreads = Math.floor(ns.hackAnalyzeThreads(target, hackMoney));
    if (requiredThreads == 0) {
        requiredThreads++;
    }
    ns.print(
        `HACK ${target}: ${hackMoney.toFixed(2)} (-${(hackMoney/serverMoney*100).toFixed(1)}%/-${(hackMoney/maxServerMoney*100).toFixed(1)}%) | ${requiredThreads} thread(s)`
    );
    return await execInNodes(ns, SCRIPT_HACK, availableServers, requiredThreads, target);
}


/**
 * Entry point
 * @param {NS} ns
*/
export async function main(ns: NS) {
    ns.disableLog("ALL");

    let targets = await getHackableServers(ns, 0, 100);
    let targetPIDsMap: Map<string, number[]> = new Map();
    targets.forEach(
        (trg) => {
            targetPIDsMap.set(trg, []);
        }
    );

    ns.atExit(
        () => {
            targetPIDsMap.forEach(
                (pids, trg) => {
                    pids.forEach(ns.kill);
                }
            );
        }
    );

    ns.print(`Working with ${targets.join(", ")}`);

    while (true) {
        // NS requires as to skip some time
        await ns.asleep(3000);

        for (let target of targets) {
            let PIDs = targetPIDsMap.get(target);
            if (PIDs.length != 0) {
                PIDs = PIDs.filter(
                    (id) => {return ns.isRunning(id) == true}
                );
            }

            if (PIDs.length == 0) {
                let newPIDs = await processServer(ns, target);
                targetPIDsMap.set(target, newPIDs);
                ns.print(`'${target}' pids: ${newPIDs.join(", ")}`);
            }
        }
    }
}
