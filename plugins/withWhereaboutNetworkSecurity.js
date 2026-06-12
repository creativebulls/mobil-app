/**
 * Expo config plugin: allow HTTP (cleartext) to the WhereAbout backend during
 * testing, and optionally trust a bundled cert for future HTTPS on the prod host.
 *
 * Regenerated on `expo prebuild`. After editing, run prebuild or update
 * android/app/src/main/res/xml/network_security_config.xml and rebuild the app.
 */
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CERT_SOURCE = path.join('assets', 'certs', 'whereabout.crt');
const RAW_CERT_NAME = 'whereabout';
const PRODUCTION_HOST = 'mobilevps.tech';

function buildNetworkSecurityConfig(hasCert) {
  const certAnchor = hasCert
    ? `            <certificates src="@raw/${RAW_CERT_NAME}" />\n`
    : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Dev: allow HTTP to localhost / LAN while developing -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">${PRODUCTION_HOST}</domain>
        <trust-anchors>
${certAnchor}            <certificates src="system" />
        </trust-anchors>
    </domain-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">localhost</domain>
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">10.0.2.2</domain>
    </domain-config>
</network-security-config>
`;
}

function withCertFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const resDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');

      const certPath = path.join(projectRoot, CERT_SOURCE);
      const hasCert = fs.existsSync(certPath);

      if (hasCert) {
        const rawDir = path.join(resDir, 'raw');
        fs.mkdirSync(rawDir, { recursive: true });
        fs.copyFileSync(certPath, path.join(rawDir, `${RAW_CERT_NAME}.crt`));
      }

      const xmlDir = path.join(resDir, 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        buildNetworkSecurityConfig(hasCert),
      );

      return cfg;
    },
  ]);
}

function withManifestReference(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    application.$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });
}

module.exports = function withWhereaboutNetworkSecurity(config) {
  config = withCertFiles(config);
  config = withManifestReference(config);
  return config;
};
