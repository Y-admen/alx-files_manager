const redis = require('redis');

class RedisClient {
  constructor() {
    this.client = redis.createClient({
      host: '127.0.0.1',
      port: 6379,
    });
    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
    });
    this.client.on('connect', () => {
      console.log('Redis client connected');
    });
    this.client.on('ready', () => {
      console.log('Redis client ready');
    });
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, value) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(value);
      });
    });
  }

  async set(key, value, duration) {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, 'EX', duration, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async del(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
