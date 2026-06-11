/**
 * Expo config plugin: trust the WhereAbout server's self-signed TLS certificate
 * on Android so the app can talk to https://187.127.180.2 without a CA-issued
 * cert.
 *
 * It does three things during `expo prebuild`:
 *   1. Copies the bundled cert into android/.../res/raw/whereabout.crt
 *   2. Writes android/.../res/xml/network_security_config.xml that adds the cert
 *      as a trust anchor (alongside the system CAs) for the server's IP/host.
 *   3. Sets android:networkSecurityConfig on the <application> element.
 *
 * Replace the cert + DOMAINS here when you move to a real domain + CA cert
 * (at which point this plugin can simply be removed).
 */
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Source cert bundled in the repo (PEM). Referenced as @raw/whereabout.
const CERT_SOURCE = path.join('assets', 'certs', 'whereabout.crt');
const RAW_CERT_NAME = 'whereabout';

// Hosts the self-signed cert should be trusted for.
const DOMAINS = ['187.127.180.2'];

function buildNetworkSecurityConfig() {
  const domainTags = DOMAINS.map(
    (d) => `        <domain includeSubdomains="false">${d}</domain>`,
  ).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config>
${domainTags}
        <trust-anchors>
            <certificates src="@raw/${RAW_CERT_NAME}" />
            <certificates src="system" />
        </trust-anchors>
    </domain-config>
</network-security-config>
`;
}

function withCertFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const resDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
      );

      const rawDir = path.join(resDir, 'raw');
      fs.mkdirSync(rawDir, { recursive: true });
      fs.copyFileSync(
        path.join(projectRoot, CERT_SOURCE),
        path.join(rawDir, `${RAW_CERT_NAME}.crt`),
      );

      const xmlDir = path.join(resDir, 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        buildNetworkSecurityConfig(),
      );

      return cfg;
    },
  ]);
}

function withManifestReference(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });
}

module.exports = function withWhereaboutNetworkSecurity(config) {
  config = withCertFiles(config);
  config = withManifestReference(config);
  return config;
};
