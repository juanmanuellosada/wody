"use client";

import { GroupManagerView } from "@/components/group/GroupManagerView";
import {
  createGroup,
  deleteGroup,
  renameGroup,
  assignStudentToGroup,
  removeStudentFromGroup,
} from "@/actions/group";
import type { Group } from "@/components/group/GroupManagerView";

interface GroupManagerProps {
  groups: Group[];
  hideCreate?: boolean;
  demo?: boolean;
}

// Production adapter: demo keeps its legacy no-op mutations while the view
// receives explicit callbacks for future local state callers.
export function GroupManager({ groups, hideCreate, demo }: GroupManagerProps) {
  return (
    <GroupManagerView
      groups={groups}
      hideCreate={hideCreate}
      onCreateGroup={createGroup}
      onDeleteGroup={deleteGroup}
      onRenameGroup={renameGroup}
      onAssignStudentToGroup={assignStudentToGroup}
      onRemoveStudentFromGroup={removeStudentFromGroup}
      legacyDemoNoOp={demo}
    />
  );
}
