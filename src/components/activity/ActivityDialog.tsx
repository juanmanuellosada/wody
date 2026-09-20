"use client";

import {
  createActivity,
  updateActivity,
  type ActivityRow,
  type SlotInput,
} from "@/actions/activity";
import { ActivityDialogView } from "@/components/activity/views/ActivityDialogView";
import type { TeacherOption } from "@/components/activity/views/view-models";

export type { ActivityRow } from "@/actions/activity";
export type { TeacherOption } from "@/components/activity/views/view-models";

interface Props {
  activity?: ActivityRow;
  activitySlotDays?: number[];
  teachers: TeacherOption[];
  canAssignTeacher: boolean;
  onClose: () => void;
  onSaved: (activity: ActivityRow, slots?: SlotInput[]) => void;
}

/** Production adapter: preserves Server Action input and result behavior. */
export function ActivityDialog(props: Props) {
  return (
    <ActivityDialogView
      {...props}
      onCreate={(input, slots) => createActivity(input, slots)}
      onUpdate={(activityId, input) => updateActivity(activityId, input)}
    />
  );
}
