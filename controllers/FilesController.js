import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue');

class FilesController {
    static async postUpload(req, res) {
        const token = req.header('X-Token');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const userId = await redisClient.get(`auth_${token}`);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { name, type, parentId = 0, isPublic = false, data } = req.body;

        if (!name) return res.status(400).json({ error: 'Missing name' });
        if (!type || !['folder', 'file', 'image'].includes(type)) return res.status(400).json({ error: 'Missing type' });
        if (type !== 'folder' && !data) return res.status(400).json({ error: 'Missing data' });

        const filesCollection = dbClient.db.collection('files');

        if (parentId !== 0) {
            const parentFile = await filesCollection.findOne({ _id: ObjectId(parentId) });
            if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
            if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
        }

        const newFile = {
            userId: ObjectId(userId),
            name,
            type,
            isPublic,
            parentId: parentId === 0 ? 0 : ObjectId(parentId),
        };

        if (type === 'folder') {
            const result = await filesCollection.insertOne(newFile);
            return res.status(201).json({
                id: result.insertedId,
                userId: newFile.userId,
                name: newFile.name,
                type: newFile.type,
                isPublic: newFile.isPublic,
                parentId: newFile.parentId,
            });
        } else {
            const fileData = Buffer.from(data, 'base64');
            const filePath = `/tmp/files_manager/${uuidv4()}`;
            await fs.promises.writeFile(filePath, fileData);

            newFile.localPath = filePath;
            const result = await filesCollection.insertOne(newFile);

            if (type === 'image') {
                await fileQueue.add({
                    userId: newFile.userId.toString(),
                    fileId: result.insertedId.toString(),
                });
            }

            return res.status(201).json({
                id: result.insertedId,
                userId: newFile.userId,
                name: newFile.name,
                type: newFile.type,
                isPublic: newFile.isPublic,
                parentId: newFile.parentId,
            });
        }
    }

    static async getShow(req, res) {
        const token = req.header('X-Token');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const userId = await redisClient.get(`auth_${token}`);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const fileId = req.params.id;
        const filesCollection = dbClient.db.collection('files');
        const file = await filesCollection.findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

        if (!file) return res.status(404).json({ error: 'Not found' });

        return res.json(file);
    }

    static async getIndex(req, res) {
        const token = req.header('X-Token');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const userId = await redisClient.get(`auth_${token}`);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const parentId = req.query.parentId || '0';
        const page = parseInt(req.query.page) || 0;
        const filesCollection = dbClient.db.collection('files');

        const query = { userId: ObjectId(userId) };
        if (parentId !== '0') {
            query.parentId = ObjectId(parentId);
        } else {
            query.parentId = 0;
        }

        const files = await filesCollection.find(query).skip(page * 20).limit(20).toArray();
        return res.json(files);
    }

    static async putPublish(req, res) {
        const token = req.header('X-Token');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const userId = await redisClient.get(`auth_${token}`);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const fileId = req.params.id;
        const filesCollection = dbClient.db.collection('files');
        const file = await filesCollection.findOneAndUpdate({ _id: ObjectId(fileId), userId: ObjectId(userId) }, { $set: { isPublic: true } }, { returnDocument: 'after' });

        if (!file.value) return res.status(404).json({ error: 'Not found' });

        return res.json(file.value);
    }

    static async putUnpublish(req, res) {
        const token = req.header('X-Token');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const userId = await redisClient.get(`auth_${token}`);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const fileId = req.params.id;
        const filesCollection = dbClient.db.collection('files');
        const file = await filesCollection.findOneAndUpdate({ _id: ObjectId(fileId), userId: ObjectId(userId) }, { $set: { isPublic: false } }, { returnDocument: 'after' });

        if (!file.value) return res.status(404).json({ error: 'Not found' });

        return res.json(file.value);
    }

    static async getFile(req, res) {
        const { id } = req.params;
        const { size } = req.query;
        const token = req.header('X-Token');

        if (!ObjectId.isValid(id)) {
            return res.status(404).json({ error: 'Not found' });
        }

        const filesCollection = dbClient.db.collection('files');
        const file = await filesCollection.findOne({ _id: ObjectId(id) });

        if (!file) {
            return res.status(404).json({ error: 'Not found' });
        }

        if (!file.isPublic) {
            if (!token) {
                return res.status(404).json({ error: 'Not found' });
            }

            const userId = await redisClient.get(`auth_${token}`);
            if (!userId || userId !== file.userId.toString()) {
                return res.status(404).json({ error: 'Not found' });
            }
        }

        if (file.type === 'folder') {
            return res.status(400).json({ error: "A folder doesn't have content" });
        }

        let filePath = file.localPath;
        if (size && ['500', '250', '100'].includes(size)) {
            filePath = `${filePath}_${size}`;
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Not found' });
        }

        const mimeType = mime.lookup(file.name);
        res.setHeader('Content-Type', mimeType);

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    }
}

export default FilesController;
