import AWS from 'aws-sdk'

// Initialize S3 Client
const {
    S3_ENDPOINT,
    S3_REGION,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME,
    S3_FORCE_PATH_STYLE,
    SIGNED_URL_EXPIRY,
} = process.env

if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    // Warn or throw? For now just warn, as build might fail if strictly throwing top-level
    console.warn('Missing S3 environment variables')
}

const s3Config: AWS.S3.ClientConfiguration = {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    s3ForcePathStyle: S3_FORCE_PATH_STYLE === 'true',
}

if (S3_ENDPOINT) {
    s3Config.endpoint = S3_ENDPOINT
}

if (S3_REGION) {
    s3Config.region = S3_REGION
}

const s3 = new AWS.S3(s3Config)
const BUCKET = S3_BUCKET_NAME || 'default-bucket'

export async function uploadFileToS3(
    buffer: Buffer,
    key: string,
    contentType: string
): Promise<string> {
    await s3
        .upload({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })
        .promise()

    return key
}

export function getSignedUrl(key: string): string {
    // If key is a full URL (legacy), return it as is or try to sign it if it matches our bucket?
    // User wants "Usually pre-signed URLs".
    // If we stored full URLs previously (e.g. cloudinary or public S3), we might break them.
    // Assumption: `key` stored in DB is relative path (e.g. "uploads/file.png").
    // If it starts with http, assume it's external/legacy and return as is.
    if (key.startsWith('http')) {
        return key
    }

    try {
        const url = s3.getSignedUrl('getObject', {
            Bucket: BUCKET,
            Key: key,
            Expires: parseInt(SIGNED_URL_EXPIRY || '3600', 10),
        })
        return url
    } catch (error) {
        console.error('Error generating signed URL:', error)
        return key // Fallback? Or empty string?
    }
}
