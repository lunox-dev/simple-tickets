import { NextRequest, NextResponse } from 'next/server'
import mime from 'mime-types'
import { uploadFileToS3, getSignedUrl } from '@/lib/s3'

export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const timestamp = Date.now()
    const original = file.name || 'upload'
    const fileName = `${timestamp}-${original}`
    const mimeType = mime.lookup(original) || 'application/octet-stream'
    // Fallback to 'uploads' if path is missing. 
    // Ideally this route is now "legacy" or "generic" upload.
    const folder = formData.get('path')?.toString() || 'uploads'
    const key = `${folder}/${fileName}`

    await uploadFileToS3(buffer, key, mimeType)

    const url = getSignedUrl(key)

    return NextResponse.json({ filePath: url })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
  }
}
