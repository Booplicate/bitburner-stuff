import { NS } from 'bitburner';

export async function main(ns: NS) {
    await ns.singularity.installBackdoor();
}
