// Expo config plugin: register react-native-hce's HostApduService so the phone can
// emulate an NFC Type 4 NDEF tag (Host Card Emulation). This is regenerated on every
// `expo prebuild` (CNG), so it survives `prebuild --clean` — unlike hand edits to android/.
//
// It injects three things into the Android project:
//   1. <uses-feature android.hardware.nfc.hce required="false">  (graceful on non-HCE phones)
//   2. <service com.reactnativehce.services.CardService ...>      (the HostApduService)
//   3. res/xml/aid_list.xml registering the NFC Forum Type 4 NDEF AID (D2760000850101)
//
// NFC permission itself is added by the react-native-nfc-manager plugin — not duplicated here.
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// NFC Forum "Type 4 Tag" NDEF Tag Application AID — what react-native-hce emulates.
const HCE_AID = 'D2760000850101';
const HCE_SERVICE = 'com.reactnativehce.services.CardService';

const AID_LIST_XML = `<?xml version="1.0" encoding="utf-8"?>
<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/app_name"
    android:requireDeviceUnlock="false">
  <aid-group android:category="other" android:description="@string/app_name">
    <aid-filter android:name="${HCE_AID}" />
  </aid-group>
</host-apdu-service>
`;

function addUsesFeature(androidManifest) {
  const manifest = androidManifest.manifest;
  manifest['uses-feature'] = manifest['uses-feature'] || [];
  const present = manifest['uses-feature'].some(
    (f) => f.$ && f.$['android:name'] === 'android.hardware.nfc.hce'
  );
  if (!present) {
    manifest['uses-feature'].push({
      $: {
        'android:name': 'android.hardware.nfc.hce',
        'android:required': 'false',
      },
    });
  }
  return androidManifest;
}

function addService(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  application.service = application.service || [];
  const present = application.service.some(
    (s) => s.$ && s.$['android:name'] === HCE_SERVICE
  );
  if (!present) {
    application.service.push({
      $: {
        'android:name': HCE_SERVICE,
        'android:exported': 'true',
        // Disabled by default; react-native-hce enables/disables it per session.
        'android:enabled': 'false',
        'android:permission': 'android.permission.BIND_NFC_SERVICE',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.nfc.cardemulation.action.HOST_APDU_SERVICE' } },
          ],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.nfc.cardemulation.host_apdu_service',
            'android:resource': '@xml/aid_list',
          },
        },
      ],
    });
  }
  return androidManifest;
}

const withHceManifest = (config) =>
  withAndroidManifest(config, (cfg) => {
    cfg.modResults = addUsesFeature(cfg.modResults);
    cfg.modResults = addService(cfg.modResults);
    return cfg;
  });

const withAidListXml = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'aid_list.xml'), AID_LIST_XML);
      return cfg;
    },
  ]);

module.exports = (config) => withAidListXml(withHceManifest(config));
