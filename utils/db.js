import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

class DBClient {
    constructor() {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 27017;
        const database = process.env.DB_DATABASE || 'files_manager';
        const url = `mongodb://${host}:${port}`;

        this.client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
        this.client.connect().then(() => {
            this.db = this.client.db(database);
        }).catch((err) => {
            console.error('MongoDB Client Error', err);
        });
    }

    async isAlive() {
        try {
            await this.client.db().admin().ping();
            return true;
        } catch (error) {
            return false;
        }
    }

    async nbUsers() {
        if (!this.db) {
            await this.client.connect();
            this.db = this.client.db(process.env.DB_DATABASE || 'files_manager');
        }
        return this.db.collection('users').countDocuments();
    }

    async nbFiles() {
        if (!this.db) {
            await this.client.connect();
            this.db = this.client.db(process.env.DB_DATABASE || 'files_manager');
        }
        return this.db.collection('files').countDocuments();
    }
}

const dbClient = new DBClient();
export default dbClient;