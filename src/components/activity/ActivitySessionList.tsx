"use client";

import { cancelActivitySession } from "@/actions/activity";
import { ActivitySessionListView } from "@/components/activity/views/ActivitySessionListView";
import type { SessionRow } from "@/components/activity/views/view-models";
import { gymPath } from "@/lib/gym";

export type { SessionRow } from "@/components/activity/views/view-models";

interface Props {
  gymSlug: string;
  activityId: string;
  sessions: SessionRow[];
  timezone: string;
}

/** Production adapter: session paths and cancellation action remain operational-only. */
export function ActivitySessionList({
  gymSlug,
  activityId,
  sessions,
  timezone,
}: Props) {
  return (
    <ActivitySessionListView
      sessions={sessions}
      timezone={timezone}
      getSessionHref={(sessionId) =>
        gymPath(gymSlug, `/turnos/gestion/${activityId}/sesiones/${sessionId}`)
      }
      onCancel={cancelActivitySession}
    />
  );
}
