const path = require('path');
const url = require('url');
const ecrequest = require('ecrequest');
const dvalue = require('dvalue');
const keccak = require('keccak');
const Bot = require(path.resolve(__dirname, 'Bot.js'));

const jsonStableStringify = (obj, opts) => {
  if (!opts) opts = {};
  if (typeof opts === 'function') opts = { cmp: opts };
  let space = opts.space || '';
  if (typeof space === 'number') space = Array(space+1).join(' ');
  const cycles = (typeof opts.cycles === 'boolean') ? opts.cycles : false;
  const replacer = opts.replacer || function(key, value) { return value; };

  const cmp = opts.cmp && (function (f) {
    return (node) => {
      (a, b) => {
        const aobj = { key: a, value: node[a] };
        const bobj = { key: b, value: node[b] };
        return f(aobj, bobj);
      };
    };
  })(opts.cmp);

  const seen = [];
  return (function stringify(parent, key, node, level) {
    const indent = space ? ('\n' + new Array(level + 1).join(space)) : '';
    const colonSeparator = space ? ': ' : ':';

    if (node && node.toJSON && typeof node.toJSON === 'function') {
      node = node.toJSON();
    }

    node = replacer.call(parent, key, node);

    if (node === undefined) {
      return;
    }
    if (typeof node !== 'object' || node === null) {
      return JSON.stringify(node);
    }
    if (isArray(node)) {
      const out = [];
      for (var i = 0; i < node.length; i++) {
        const item = stringify(node, i, node[i], level+1) || JSON.stringify(null);
        out.push(indent + space + item);
      }
      return '[' + out.join(',') + indent + ']';
    } else {
      if (seen.indexOf(node) !== -1) {
        if (cycles) return JSON.stringify('__cycle__');
          throw new TypeError('Converting circular structure to JSON');
      } else {
        seen.push(node);
      }
      const keys = objectKeys(node).sort(cmp && cmp(node));
      const out = [];
      for (var i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = stringify(node, key, node[key], level+1);

        if(!value) continue;

        const keyValue = JSON.stringify(key) + colonSeparator + value;
        out.push(indent + space + keyValue);
      }
      seen.splice(seen.indexOf(node), 1);
      return '{' + out.join(',') + indent + '}';
    }
  })({ '': obj }, '', obj, 0);
};

const isArray = Array.isArray || function (x) {
    return {}.toString.call(x) === '[object Array]';
};

const objectKeys = Object.keys || function (obj) {
    const has = Object.prototype.hasOwnProperty || function () { return true };
    const keys = [];
    for (var key in obj) {
        if (has.call(obj, key)) keys.push(key);
    }
    return keys;
};

class APICrawler extends Bot {
    constructor() {
      super();
      this.name = 'APICrawler';
      this.period = 60 * 60 * 1000;
    }

    init({ config, database, logger, i18n }) {
      return super.init({ config, database, logger, i18n })
      .then(() => this);
    }

    start() {
      this.certificateAll();
      return super.start();
    }

    certificateAll() {
      return this.certificateTidebit()
      .then(() => {
        setTimeout(() => this.certificateAll(), this.period);
      });
    }

    formatMetadata({ data, from }) {
      const dataFrom = typeof from == 'string' ? from.toLowerCase() : '';
      let metadata;
      switch(dataFrom) {
        case 'tidebit':
          metadata = this.formatTidebitData({ data });
          break;

        case 'tideal':
          metadata = this.formatTiDealData({ data });
          break;
        
        default:
          metadata = jsonStableStringify(data);
      }
      return metadata;
    }

    /* for TideBit (S) */
    certificateTidebit() {
      return this.crawlTidebit();
    }
    formatTidebitData({ data }) {
      const tmpString = jsonStableStringify(data);
      const hash = keccak('keccak256').update(tmpString).digest('hex');
      let result = `Tidebit|${data.reason}|${new Date(data.created_at).getTime()}|${hash}`;
      return result;
    }
    crawlTidebit() {
      let tidebit_opid, old_opid, apiurl, opt;
      return this.readLeveldb({ key: 'tidebit.opid' })
      .then((v) => {
        // fetch operation from tidebit
        old_opid = parseInt(v) || 1;old_opid=1;
        tidebit_opid = old_opid;
        apiurl = `https://test.tidebit.com/api/v2/account_version.json?account_version_id=${tidebit_opid}`;
        opt = url.parse(apiurl);
        return ecrequest.request(opt);
      })
      .then((v) => {
        // certificate to BOLT
        const opArr = JSON.parse(v.data);
        return opArr.map((o) => {
          tidebit_opid = o.id >= tidebit_opid ? o.id + 1 : tidebit_opid;
          return this.certificate({
            metadata: this.formatTidebitData({ data: o })
          });
        });
      })
      .then((v) => {
        // record opid
        return Promise.all(v).then(() => this.writeLeveldb({ key: 'tidebit.opid', value: tidebit_opid }));
      })
      .then((v) => {
        return Promise.resolve(true);
      });
    }
    /* for TideBit (E) */

    /* for TiDeal (S) */
    formatTiDealData({ data }) {
      const tmpString = jsonStableStringify(data);
      const hash = keccak('keccak256').update(tmpString).digest('hex');
      let result = `TiDeal|record|0|${hash}`;
      return result;
    }
    /* for TiDeal (E) */

    search({ body, params, query }) {
      const source = { from: query.from, data: body };
      const metadata = this.formatMetadata(source);
      const apiurl = `http://54.173.59.238/bolt/txhashs?apiKey=kissmyass&metadata=${metadata}`;
      const opt = url.parse(apiurl);
      return ecrequest.get(opt).then((v) => JSON.parse(v.data));
    }

    certificateFrom({ body, params, query }) {
      const metadata = this.formatMetadata({ data: body, from: query.from });
      return this.certificate({ metadata });
    }

    certificate({ metadata }) {
      const apiurl = `http://${this.config.bolt.agent}/bolt/remittance/${this.config.bolt.venderID}/0x0000000000000000000000000000000000000001?apiKey=${this.config.bolt.apiKey}`;
      const opt = url.parse(apiurl);
      opt.headers = { 'content-type': 'application/json' };
      opt.data = {
        tokenType: "ETH",
        value: "0",
        metadata
      };
      return ecrequest.post(opt)
      .then(v => new Promise((resolve, reject) => {
        setTimeout(() => resolve(v), 100);
      }))
      .then(v => Promise.resolve(true));
    }
}

module.exports = APICrawler;