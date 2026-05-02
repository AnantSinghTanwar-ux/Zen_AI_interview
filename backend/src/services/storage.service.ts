import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getCloudinary } from '../config/cloudinary';

export interface UploadResult {
  url: string;
  resourceType?: string;
  publicId?: string;
}

const isPdf = (mimeType: string): boolean => mimeType === 'application/pdf';

const createTempFileFromBuffer = async (file: Express.Multer.File): Promise<string> => {
  const tmpDir = path.join(os.tmpdir(), 'hiring-platform-uploads');
  await fs.mkdir(tmpDir, { recursive: true });

  const safeName = path.basename(file.originalname).replace(/[^\w.\-]+/g, '_') || 'upload';
  const tempPath = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`);
  await fs.writeFile(tempPath, file.buffer);
  return tempPath;
};

const resolveCloudinaryFolder = (folder: string, mimeType: string): string => {
  if (isPdf(mimeType)) return 'resumes';
  if (folder === 'logos' || folder === 'photos' || folder === 'profile-images') return 'profile-images';
  return folder || 'uploads';
};

async function cloudinaryUpload(
  file: Express.Multer.File,
  folder: string,
): Promise<UploadResult> {
  const cloudinary = getCloudinary();
  const tempPath = await createTempFileFromBuffer(file);

  try {
    const uploadResult = await cloudinary.uploader.upload(tempPath, {
      folder: resolveCloudinaryFolder(folder, file.mimetype),
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });

    return {
      url: uploadResult.secure_url,
      resourceType: uploadResult.resource_type,
      publicId: uploadResult.public_id,
    };
  } catch (err) {
    throw Object.assign(new Error('Cloudinary upload failed'), {
      statusCode: 502,
      code: 'CLOUDINARY_UPLOAD_FAILED',
      details: err,
    });
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

const extractCloudinaryPublicId = (url: string): string | null => {
  if (!url.includes('res.cloudinary.com')) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:\?.*)?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

async function deleteFromCloudinary(url: string): Promise<void> {
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return;

  const cloudinary = getCloudinary();
  // Try common resource types to support both images and raw files (e.g., PDF resumes).
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => undefined);
  await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }).catch(() => undefined);
}

export const StorageService = {
  async uploadResume(file: Express.Multer.File): Promise<UploadResult> {
    return cloudinaryUpload(file, 'resumes');
  },

  async uploadPhoto(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    return cloudinaryUpload(file, folder || 'profile-images');
  },

  async uploadAny(file: Express.Multer.File): Promise<UploadResult> {
    const folder = isPdf(file.mimetype) ? 'resumes' : 'profile-images';
    return cloudinaryUpload(file, folder);
  },

  async deleteByUrl(url: string): Promise<void> {
    if (!url) return;

    // Legacy cleanup support for old local file URLs.
    if (url.startsWith('/uploads/')) {
      const relativePath = url.replace('/uploads/', '');
      const fullPath = path.join(__dirname, '../../uploads', relativePath);
      await fs.unlink(fullPath).catch(() => undefined);
      return;
    }

    // Legacy cleanup support for old S3 URLs.
    if (url.includes('amazonaws.com')) {
      const { deleteFromS3 } = await import('../utils/s3');
      await deleteFromS3(url).catch(() => undefined);
      return;
    }

    await deleteFromCloudinary(url).catch(() => undefined);
  },
};
