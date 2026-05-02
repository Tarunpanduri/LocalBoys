const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// All pods that import React headers inside framework modules
// and break under Xcode 16 / iOS 26 SDK
const PODS_NEEDING_DEFINES_MODULE_NO = [
  'react-native-maps',
  'RNFBApp',
  'RNFBAuth',
  'RNFBFirestore',
  'RNFBFunctions',
  'RNFBStorage',
  'RNFBMessaging',
  'RNFBCrashlytics',
  'RNFBAnalytics',
  'RNFBDatabase',
  'RNFBDynamicLinks',
  'RNFBPerf',
  'RNFBRemoteConfig',
];

module.exports = function withNonModularHeaderFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const guardComment = '# [NonModularFix] injected by withNonModularHeaderFix';

      if (!podfile.includes(guardComment)) {
        const podNames = PODS_NEEDING_DEFINES_MODULE_NO.map(
          (name) => `'${name}'`
        ).join(', ');

        const patch = `
  ${guardComment}
  affected_pods = [${podNames}]
  installer.pods_project.targets.each do |target|
    if affected_pods.include?(target.name)
      target.build_configurations.each do |config|
        config.build_settings['DEFINES_MODULE'] = 'NO'
        config.build_settings['SWIFT_INSTALL_OBJC_HEADER'] = 'NO'
      end
    end
  end
`;

        podfile = podfile.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|\n${patch}`
        );

        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);
};