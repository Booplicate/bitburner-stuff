import { NS } from 'bitburner';

/** @param {NS} ns */
export async function main(ns: NS) {
    let target = ns.args[0].toString();
    await ns.weaken(target);
}
