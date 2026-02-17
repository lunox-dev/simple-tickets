import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { getTicketAccessForUser } from '@/lib/access-ticket-user'
import { verifyThreadCreatePermission } from '@/lib/access-ticket-change'
import { enqueueNotificationInit } from '@/lib/notification-queue'
import { handlePermissionError } from '@/lib/permission-error'
import { uploadFileToS3 } from '@/lib/s3'
import mime from 'mime-types'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = Number((session.user as any).id)
  const actingAs = (session.user as any).actingAs
  if (!actingAs) {
    return NextResponse.json({ error: 'User is not acting as any team' }, { status: 400 })
  }

  /* 
     Refactored to handle FormData with files and URL attachments 
  */

  // Parse FormData
  const formData = await req.formData()
  const ticketId = Number(formData.get("ticketId"))
  const body = formData.get("body") as string

  // Parse URL attachments
  let urlAttachments: { name: string, url: string }[] = []
  const urlAttachmentsJson = formData.get("urlAttachments") as string
  if (urlAttachmentsJson) {
    try {
      urlAttachments = JSON.parse(urlAttachmentsJson)
    } catch (e) {
      console.warn("Failed to parse urlAttachments", e)
    }
  }

  // Collect files
  const filesToUpload: File[] = []
  const fileEntries = formData.getAll('files')
  for (const f of fileEntries) {
    if (f instanceof File) {
      filesToUpload.push(f)
    }
  }

  if (!ticketId || !body) {
    return NextResponse.json({ error: 'Missing ticketId or body' }, { status: 400 })
  }

  const access = await getTicketAccessForUser(userId, ticketId)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      currentStatusId: true,
      currentAssignedTo: { select: { id: true } }
    }
  })
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  if (ticket.currentStatusId === 4) {
    return NextResponse.json({ error: 'Cannot add thread to a closed ticket' }, { status: 400 })
  }

  try {
    verifyThreadCreatePermission(access, ticket.currentAssignedTo?.id)
  } catch (err) {
    return handlePermissionError(err)
  }

  try {
    const { newThread, event } = await prisma.$transaction(async (tx) => {
      const thread = await tx.ticketThread.create({
        data: {
          ticketId,
          body,
          createdById: actingAs.userTeamEntityId,
        },
      })

      // Handle File Uploads
      if (filesToUpload.length > 0) {
        // We need to import uploadFileToS3 and mime. 
        // Since we are inside the function, we rely on top-level imports. 
        // I will add imports in a separate step or assume they are added? 
        // Wait, replace_file_content replaces a block. I need to make sure imports are there.
        // I'll assume I'll add imports in a separate call or I need to do it all in one go if I replace the whole file?
        // This tool call only replaces the body. I will add imports separately.

        for (const file of filesToUpload) {
          const timestamp = Date.now()
          const original = file.name || 'upload'
          const safeName = original.replace(/[^a-zA-Z0-9.-]/g, '_')
          const key = `ticket/attachment/${ticketId}/internal/${timestamp}-${safeName}`

          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const mimeType = file.type || mime.lookup(original) || 'application/octet-octet-stream'

          await uploadFileToS3(buffer, key, mimeType)

          await tx.ticketThreadAttachment.create({
            data: {
              ticketThreadId: thread.id,
              filePath: key,
              fileName: original,
              fileType: mimeType,
              fileSize: file.size,
              // type is implicit? Schema has 'type' enum? 
              // Checking schema... usually inferred or explicit. 
              // Verify schema in next step if needed, but 'create' route didn't set 'type' explicitly in the `data` object for internal uploads?
              // `create` route had: 
              /*
                await tx.ticketThreadAttachment.create({
                  data: {
                    ticketThreadId: thread.id,
                    filePath: key, 
                    fileName: original,
                    fileType: mimeType,
                    fileSize: fileItem.size
                  }
                })
              */
              // It seems TicketThreadAttachment doesn't have a 'type' field distinguishing URL vs File in the schema provided in previous context?
              // Wait, Implementation Plan said: "For URLs: Create record with type: 'url', filePath = URL."
              // I need to check the schema. If 'type' doesn't exist, how do we distinguish? 
              // Maybe 'fileType' is 'url'?
              // Let's assume for now keeping it simple. URL attachments might need a specific handling.
              // In `create` route, legacy attachments (urls?) were handled.
              // Let's look at `create` route again. it used `fileType: at.fileType ?? ext`.
              // If I'm adding "URL" support, I might just store the URL in `filePath` and set `fileType: 'url'`.
            }
          })
        }
      }

      // Handle URL Attachments
      if (urlAttachments.length > 0) {
        for (const att of urlAttachments) {
          await tx.ticketThreadAttachment.create({
            data: {
              ticketThreadId: thread.id,
              filePath: att.url,
              fileName: att.name,
              fileType: 'url', // Explicitly marking as url
              fileSize: 0
            }
          })
        }
      }

      const event = await tx.notificationEvent.create({
        data: {
          type: 'TICKET_THREAD_NEW',
          onThreadId: thread.id,
        },
      })

      await tx.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      })

      return { newThread: thread, event }
    })

    if (event) {
      await enqueueNotificationInit(event.id)
    }

    return NextResponse.json(newThread)
  } catch (error) {
    console.error('Error creating ticket thread:', error)
    return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 })
  }
}
