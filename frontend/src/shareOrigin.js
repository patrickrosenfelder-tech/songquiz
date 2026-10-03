const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

// Where invite and challenge links should point. A link to "localhost" only works on
// this computer, so when the host plays on localhost we swap in the Wi-Fi address.
export function shareOrigin(config) {
  const { protocol, hostname, port, origin } = window.location;
  if (config?.publicUrl) return config.publicUrl.replace(/\/+$/, '');
  if (LOCAL_HOSTS.includes(hostname) && config?.wifiAddress) {
    return `${protocol}//${config.wifiAddress}${port ? `:${port}` : ''}`;
  }
  return origin;
}
