import { v2 as cloudinary } from 'cloudinary';

let configured = false;

export const getCloudinary = () => {
  if (!configured) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw Object.assign(new Error('Cloudinary environment variables are not configured'), {
        statusCode: 500,
        code: 'CLOUDINARY_CONFIG_MISSING',
      });
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    configured = true;
  }

  return cloudinary;
};
