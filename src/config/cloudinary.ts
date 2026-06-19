import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

let isCloudinaryConfigured = false;

if (!cloudName || !apiKey || !apiSecret) {
  console.error(
    '========================================================================\n' +
    '⚠️  WARNING: Cloudinary configuration is missing or incomplete.\n' +
    'Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.\n' +
    'Media upload endpoints will fail safely with a configuration error.\n' +
    '========================================================================'
  );
} else {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  isCloudinaryConfigured = true;
}

export { cloudinary, isCloudinaryConfigured };
export default cloudinary;
