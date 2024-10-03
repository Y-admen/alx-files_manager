import fs from 'fs';
import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async getFile(req, res) {
    const { id } = req.params;
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

    const filePath = file.localPath;
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
