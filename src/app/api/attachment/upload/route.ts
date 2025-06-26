// src/app/api/attachment/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import AWS from 'aws-sdk'
import mime from 'mime-types'

export const config = {
  api: {
    bodyParser: false,
  },
}

const {
  MINIO_BUCKET_NAME,
  MINIO_ENDPOINT,
  MINIO_ACCESS_KEY_ID,
  MINIO_SECRET_ACCESS_KEY,
  MINIO_PUBLIC_URL,
  USE_SIGNED_URLS,
  CUSTOM_CDN_URL,
  SIGNED_URL_EXPIRY,
} = process.env

if (
  !MINIO_BUCKET_NAME ||
  !MINIO_ENDPOINT ||
  !MINIO_ACCESS_KEY_ID ||
  !MINIO_SECRET_ACCESS_KEY ||
  !MINIO_PUBLIC_URL
) {
  throw new Error('Missing MinIO environment variables')
}

// Use AWS SDK v2 (you installed `aws-sdk@2.x`)
const s3 = new AWS.S3({
  endpoint: MINIO_ENDPOINT,
  accessKeyId: MINIO_ACCESS_KEY_ID,
  secretAccessKey: MINIO_SECRET_ACCESS_KEY,
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
})

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const timestamp = Date.now();
    const original = file.name || 'upload';
    const fileName = `${timestamp}-${original}`;
    const mimeType = mime.lookup(original) || 'application/octet-stream';
    const folder = formData.get('path')?.toString() || 'uploads';
    const key = `${folder}/${fileName}`;

    // Upload to MinIO/S3
    await s3.upload({
      Bucket: MINIO_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }).promise();

    // Build the public URL
    let url: string;
    if (USE_SIGNED_URLS === 'true') {
      url = s3.getSignedUrl('getObject', {
        Bucket: MINIO_BUCKET_NAME!,
        Key: key,
        Expires: parseInt(SIGNED_URL_EXPIRY || '3600', 10),
      });
    } else if (CUSTOM_CDN_URL) {
      url = `${CUSTOM_CDN_URL}/${MINIO_BUCKET_NAME}/${key}`;
    } else {
      url = `${MINIO_PUBLIC_URL}/${MINIO_BUCKET_NAME}/${key}`;
    }

    return NextResponse.json({ filePath: url });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
  }
}
