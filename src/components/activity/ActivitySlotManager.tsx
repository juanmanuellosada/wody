"use client";

import {
  createActivitySlot,
  deactivateActivitySlot,
  updateActivitySlot,
  type SlotRow,
} from "@/actions/activity";
import { ActivitySlotManagerView } from "@/components/activity/views/ActivitySlotManagerView";
import type { ActivityScheduleKind } from "@/components/activity/views/view-models";

export type { SlotRow } from "@/actions/activity";

interface Props {
  activityId: string;
  scheduleKind: ActivityScheduleKind;
  slots: SlotRow[];
}

/** Production adapter: only this wrapper imports slot Server Actions. */
export function ActivitySlotManager({
  activityId,
  scheduleKind,
  slots,
}: Props) {
  return (
    <ActivitySlotManagerView
      scheduleKind={scheduleKind}
      slots={slots}
      onCreate={(input) => createActivitySlot(activityId, input)}
      onUpdate={updateActivitySlot}
      onDeactivate={deactivateActivitySlot}
    />
  );
}
