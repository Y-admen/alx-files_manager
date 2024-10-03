import Queue from 'bull';
import { ObjectId } from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');

fileQueue.process(async(job) => {
    const { fileId, userId } = job.data;

    if (!fileId) {
        throw new Error('Missing fileId');
    }

    if (!userId) {
        throw new Error('Missing userId');
    }

    const filesCollection = dbClient.db.collection('files');
    const file = await filesCollection.findOne({
        _id: ObjectId(fileId),
        userId: ObjectId(userId),
    });

    if (!file) {
        throw new Error('File not found');
    }

    const sizes = [500, 250, 100];

    for (const size of sizes) {
        const thumbnail = await imageThumbnail(file.localPath, { width: size });
        const thumbnailPath = `${file.localPath}_${size}`;
        await fs.promises.writeFile(thumbnailPath, thumbnail);
    }
});