import { env } from '../../config/env';

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

function split(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Free public TURN relay (Open Relay Project by Metered). Used as a fallback so
 * calls can connect on restrictive/cellular networks even when no private TURN
 * server is configured. For production reliability, set TURN_URLS to your own
 * coturn server. The TCP/443 entry helps traverse strict firewalls.
 */
const FALLBACK_TURN: IceServer = {
  urls: [
    'turn:openrelay.metered.ca:80',
    'turn:openrelay.metered.ca:443',
    'turn:openrelay.metered.ca:443?transport=tcp',
  ],
  username: 'openrelayproject',
  credential: 'openrelayproject',
};

/**
 * Builds the ICE server list clients use to negotiate WebRTC connections.
 * STUN is always included; TURN is added only when configured (recommended for
 * reliable connectivity on cellular/mobile networks).
 */
export function getIceServers(): IceServer[] {
  const iceServers: IceServer[] = [];

  const stunUrls = split(env.STUN_URLS);
  if (stunUrls.length > 0) {
    iceServers.push({ urls: stunUrls });
  }

  if (env.TURN_URLS) {
    const turnUrls = split(env.TURN_URLS);
    if (turnUrls.length > 0) {
      iceServers.push({
        urls: turnUrls,
        username: env.TURN_USERNAME,
        credential: env.TURN_CREDENTIAL,
      });
    }
  } else {
    // No private TURN configured — fall back to a public relay so calls still
    // connect on cellular/symmetric-NAT networks.
    iceServers.push(FALLBACK_TURN);
  }

  return iceServers;
}
