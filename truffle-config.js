require('babel-register');
require('babel-polyfill');

/* eslint-disable import/no-extraneous-dependencies */
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bn')(require('bn.js')))
  .use(require('dirty-chai'))
  .expect();

const ganache = require('ganache-core');
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
      network_id: '*',
      provider: ganache.provider({
        total_accounts: 30,
        defaultEtherBalance: 1000,
      }),
    },
  },
  plugins: ['solidity-coverage'],
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
