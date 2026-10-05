module.exports = function (config) {
  config.set({
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [require('karma-jasmine'), require('karma-chrome-launcher'), require('@angular-devkit/build-angular/plugins/karma')],
    customLaunchers: {
      ChromeHeadlessNoGpu: {
        base: 'ChromeHeadless',
        flags: ['--disable-gpu', '--disable-software-rasterizer', '--no-sandbox', '--disable-dev-shm-usage'],
      },
    },
    browsers: ['ChromeHeadlessNoGpu'],
  });
};
