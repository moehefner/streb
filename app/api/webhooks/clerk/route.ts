import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Clerk Webhook Handler
 * 
 * This webhook syncs Clerk user events to our Supabase database.
 * 
 * Setup in Clerk Dashboard:
 * 1. Go to Webhooks in your Clerk dashboard
 * 2. Add endpoint: https://yourdomain.com/api/webhooks/clerk
 * 3. Subscribe to: user.created, user.updated, user.deleted
 * 4. Copy the webhook secret to CLERK_WEBHOOK_SECRET
 */

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', {
      status: 400
    });
  }

  // Get the body
  const payload = await req.text();
  const body = JSON.parse(payload);

  // Get the Webhook secret
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occurred', {
      status: 400
    });
  }

  // Handle the webhook
  const eventType = evt.type;
  console.log(`Webhook received: ${eventType}`);

  try {
    switch (eventType) {
      case 'user.created':
        await handleUserCreated(evt);
        break;
      case 'user.updated':
        await handleUserUpdated(evt);
        break;
      case 'user.deleted':
        await handleUserDeleted(evt);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle user creation
 */
async function handleUserCreated(evt: WebhookEvent) {
  const userData = evt.data as any; // Type assertion for webhook data
  const { id, email_addresses, first_name, last_name } = userData;

  const primaryEmail = email_addresses?.find((email: any) => email.id === userData.primary_email_address_id);
  
  if (!primaryEmail?.email_address) {
    console.error('No primary email found for user:', id);
    return;
  }

  const fullName = [first_name, last_name].filter(Boolean).join(' ') || null;

  try {
    const user = await prisma.user.create({
      data: {
        clerkUserId: id as string,
        email: primaryEmail.email_address,
        fullName,
        // Default plan and limits for new users
        planType: 'free',
        postsLimit: 5,
        videosLimit: 3,
        emailsLimit: 25,
      },
    });

    console.log('User created in database:', user.id);
  } catch (error) {
    // Handle case where user already exists
    if (error instanceof Error && error.message.includes('unique constraint')) {
      console.log('User already exists in database:', id);
      return;
    }
    throw error;
  }
}

/**
 * Handle user updates
 */
async function handleUserUpdated(evt: WebhookEvent) {
  const userData = evt.data as any; // Type assertion for webhook data
  const { id, email_addresses, first_name, last_name } = userData;

  const primaryEmail = email_addresses?.find((email: any) => email.id === userData.primary_email_address_id);
  
  if (!primaryEmail?.email_address) {
    console.error('No primary email found for user:', id);
    return;
  }

  const fullName = [first_name, last_name].filter(Boolean).join(' ') || null;

  try {
    const user = await prisma.user.update({
      where: { clerkUserId: id as string },
      data: {
        email: primaryEmail.email_address,
        fullName,
      },
    });

    console.log('User updated in database:', user.id);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

/**
 * Handle user deletion
 */
async function handleUserDeleted(evt: WebhookEvent) {
  const userData = evt.data as any; // Type assertion for webhook data
  const { id } = userData;

  try {
    await prisma.user.delete({
      where: { clerkUserId: id as string },
    });

    console.log('User deleted from database:', id);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}