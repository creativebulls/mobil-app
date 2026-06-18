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
  }

  return iceServers;
}
