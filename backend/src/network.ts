import { networkInterfaces } from 'os';

export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net): net is NonNullable<typeof net> => !!net && net.family === 'IPv4' && !net.internal)
    .map(net => net.address);
}

// 100.64.0.0/10 is used by VPNs like Tailscale, not the local Wi-Fi
export function isVpnAddress(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return a === 100 && b >= 64 && b <= 127;
}

// The address phones on the same Wi-Fi can reach this machine at
export function wifiAddress(): string | null {
  return lanAddresses().find(ip => !isVpnAddress(ip)) || null;
}
