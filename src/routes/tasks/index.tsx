import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/workspace/WorkspaceSidebar";
import { TaskListPage } from "@/components/tasks/TaskListPage";

export const Route = createFileRoute("/tasks/")({
  component: TasksIndex,
});

function TasksIndex() {
  return (
    <WorkspaceShell nav="tasks">
      <TaskListPage />
    </WorkspaceShell>
  );
}
