import { defineConfig } from '#q-app';

export default defineConfig((/* ctx */) => {
  return {
    boot: [],

    css: ['app.scss'],

    extras: [
      'roboto-font',
      'material-icons',
    ],

    build: {
      target: {},
      typescript: {
        strict: true,
        vueShim: true,
      },
      vueRouterMode: 'hash',
    },

    devServer: {
      open: true,
    },

    framework: {
      config: {},
      plugins: [
        'Dark',
        'Notify',
        'Dialog',
        'Loading',
        'LocalStorage',
        'SessionStorage',
      ],
    },

    animations: [],

    ssr: {
      prodPort: 3000,
      middlewares: ['render'],
      pwa: false,
    },

    pwa: {
      workboxMode: 'GenerateSW',
    },

    capacitor: {
      hideSplashscreen: true,
    },

    electron: {
      preloadScripts: ['electron-preload'],
      inspectPort: 5858,
      bundler: 'packager',
      packager: {
        // Use pre-downloaded Electron zip to avoid network fetch
        electronZipDir: process.cwd() + '/src-electron/electron-zip',
      },
      builder: {
        appId: 'com.mistakenote.app',
      },
    },

    bex: {
      extraScripts: [],
    },
  };
});
