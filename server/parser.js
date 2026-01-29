function parseAsusOutput(output) {
    const lines = output.split('\n');
    // Typical interfaces for ASUS WAN: eth0, ppp0, vlan2
    const wanLine = lines.find(l => l.includes('eth0:') || l.includes('ppp0') || l.includes('vlan2:'));

    if (!wanLine) return null;

    const parts = wanLine.trim().split(/\s+/);
    // parts[1] is RX bytes, parts[9] is TX bytes in /proc/net/dev
    const rx = parseInt(parts[1]);
    const tx = parseInt(parts[9]);

    if (isNaN(rx) || isNaN(tx)) return null;

    return { rx, tx };
}

module.exports = { parseAsusOutput };
