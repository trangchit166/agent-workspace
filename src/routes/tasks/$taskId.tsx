import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/workspace/WorkspaceSidebar";
import { TaskDetailPage } from "@/components/tasks/TaskDetailPage";

export const Route = createFileRoute("/tasks/$taskId")({
  component: TaskDetail,
});

function TaskDetail() {
  const { taskId } = Route.useParams();
  return (
    <WorkspaceShell nav="tasks">
      <TaskDetailPage taskId={taskId} />
    </WorkspaceShell>
  );
}
