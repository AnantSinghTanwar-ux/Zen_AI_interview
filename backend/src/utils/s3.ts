import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import path from 'path';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;
const CDN = process.env.AWS_CLOUDFRONT_URL || `https://${BUCKET}.s3.amazonaws.com`;

export const uploadToS3 = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder: string,
): Promise<string> => {
  const ext = path.extname(originalName);
  const key = `${folder}/${randomBytes(16).toString('hex')}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return `${CDN}/${key}`;
};

export const deleteFromS3 = async (url: string): Promise<void> => {
  const key = url.replace(`${CDN}/`, '');
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

export const getPresignedUrl = async (key: string, expiresIn = 3600): Promise<string> =>
  getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
