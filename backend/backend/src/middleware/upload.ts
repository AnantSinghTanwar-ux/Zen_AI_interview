import multer from 'multer';

const storage = multer.memoryStorage();

const allowedResumeMime = new Set([
  'application/pdf',
]);

const allowedImageMime = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (allowedResumeMime.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      Object.assign(new Error('Only PDF files are allowed'), {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
      }),
    );
  }
};

export const uploadResume = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadImage = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (allowedImageMime.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(new Error('Only JPG and PNG images are allowed'), {
          statusCode: 400,
          code: 'INVALID_FILE_TYPE',
        }),
      );
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadFile = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (allowedResumeMime.has(file.mimetype) || allowedImageMime.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(
      Object.assign(new Error('Only JPG, PNG, and PDF files are allowed'), {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
      }),
    );
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});
