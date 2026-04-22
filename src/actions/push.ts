"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type PushResult =
  | { success: true }
  | { success: false; error: string };

interface SubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function savePushSubscription(
  input: SubscriptionInput
): Promise<PushResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "No autorizado." };
  }

  const { endpoint, keys } = input;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return { success: false, error: "Subscription inválida." };
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    update: {
      userId: session.user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  return { success: true };
}

export async function deletePushSubscription(
  endpoint: string
): Promise<PushResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "No autorizado." };
  }

  await prisma.pushSubscription
    .delete({ where: { endpoint } })
    .catch(() => {});

  return { success: true };
}
