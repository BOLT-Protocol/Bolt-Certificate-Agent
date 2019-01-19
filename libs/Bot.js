const Bots = [];

class Bot {
  constructor() {
    Bots.push(this);
  }
  init({ config, database, logger, i18n }) {
    this.config = config;
    this.database = database;
    this.logger = logger;
    this.i18n = i18n;
    return Promise.resolve(this);
  }
  start() {
    return Promise.resolve(this);
  }
  ready() {
    return Promise.resolve(this);
  }
  getBot(name) {
    const condition = new RegExp('^' + name + '$', 'i');
    const bot = Bots.find((b) => {
      return condition.test(b.name);
    });
    return Promise.resolve(bot);
  }

  readLeveldb({ key }) {
    return new Promise((resolve, reject) => {
      this.database.leveldb.get(key, (err, value) => {
        if(err) {
          resolve();
        } else {
          resolve(value);
        }
      });
    });
  }
  writeLeveldb({ key, value }) {
    return new Promise((resolve, reject) => {
      this.database.leveldb.put(key, value, (err) => {
        if(err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  static get isBot() {
    return true;
  }
};

module.exports = Bot;
