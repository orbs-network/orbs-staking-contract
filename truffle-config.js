require('babel-register');
require('babel-polyfill');

/* eslint-disable import/no-extraneous-dependencies */
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bn')(require('bn.js')))
  .use(require('dirty-chai'))
  .expect();
/* eslint-enable import/no-extraneous-dependencies */

const process = require('process');

const mochaOptions = {
  useColors: true,
  slow: 30000,
  bail: true,
};

const { WITH_GAS_PROFILER } = process.env;

if (WITH_GAS_PROFILER) {
  mochaOptions.reporter = 'eth-gas-reporter';
  mochaOptions.reporterOptions = {
    currency: 'USD',
    gasPrice: 2,
  };
}

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 7545,
      network_id: '*',
    },
    coverage: {
      host: 'localhost',
      network_id: '*',
      port: 7555,
      gas: 0xfffffffffff,
      gasPrice: 0x01,
    },
  },
  compilers: {
    solc: {
      version: '0.5.16',
      settings: {
        optimizer: {
          enabled: true,
          runs: 1000,
        },
      },
    },
  },
  mocha: mochaOptions,
};
