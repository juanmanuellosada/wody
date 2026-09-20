"use client";

import {
  createActivity,
  deleteActivity,
  previewActivityDeletion,
  updateActivity,
  type ActivityRow,
} from "@/actions/activity";
import { ActivityListView } from "@/components/activity/views/ActivityListView";
import type { TeacherOption } from "@/components/activity/views/view-models";
import { gymPath } from "@/lib/gym";

type SlotSummary = {
  dayOfWeek: number | null;
  date: string | null;
  startMinute: number;
  endMinute: number;
};
export type ActivityListRow = ActivityRow & { slots: SlotSummary[] };

interface Props {
  gymSlug: string;
  activities: ActivityListRow[];
  teachers: TeacherOption[];
  canAssignTeacher: boolean;
}

/** Production adapter: Server Actions and gym path stay outside the view. */
export function ActivityList({
  gymSlug,
  activities,
  teachers,
  canAssignTeacher,
}: Props) {
  return (
    <ActivityListView
      activities={activities}
      teachers={teachers}
      canAssignTeacher={canAssignTeacher}
      getActivityHref={(activityId) =>
        gymPath(gymSlug, `/turnos/gestion/${activityId}`)
      }
      onCreate={createActivity}
      onUpdate={updateActivity}
      onPreviewDelete={previewActivityDeletion}
      onDelete={deleteActivity}
    />
  );
}
