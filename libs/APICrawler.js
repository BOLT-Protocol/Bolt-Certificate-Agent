const path = require('path');
const ecrequest = require('ecrequest');
const dvalue = require('dvalue');
const Bot = require(path.resolve(__dirname, 'Bot.js'));

class APICrawler extends Bot {
    constructor() {
      super();
      this.name = 'FindCafeca';
    }

    init({ config, database, logger, i18n }) {
      return super.init({ config, database, logger, i18n })
      .then(() => this);
    }

    start() {
      return super.start();
    }

    crawlAll() {
      this.crawliSunOne();

    }

    crawliSunOne() {
      const isunone_opid = 1;
      const apiurl = `https://test.tidebit.com/api/v2/account_version.json?account_version_id=${opid}`;
      ecrequest.request(opt).then(v => { console.log(v.data.toString()); });
    }
}

module.exports = APICrawler;