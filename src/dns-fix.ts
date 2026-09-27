import 'dotenv/config';
import { setServers } from 'dns';

/**
 * On some Windows/VPN setups, Node's built-in DNS resolver (c-ares) is
 * pointed at a local stub (e.g. 127.0.0.1) that refuses raw SRV queries,
 * even though the OS resolver works fine - which breaks `mongodb+srv://`
 * connection strings with "querySrv ECONNREFUSED". Setting DNS_SERVERS in
 * .env (comma separated, e.g. "1.1.1.1,8.8.8.8") works around it. No-op if
 * DNS_SERVERS is unset, so this only kicks in on machines that need it.
 */
const dnsServers = process.env.DNS_SERVERS;
if (dnsServers) {
  setServers(dnsServers.split(',').map((s) => s.trim()));
}
