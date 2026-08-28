import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { runsOfTask, type ScheduledTask } from "@/lib/scheduled-tasks";

/**
 * Xác nhận xoá tác vụ (FR-2, EC-6). Luôn nêu rõ hệ quả và luôn đưa ra đường
 * lùi "tắt thay vì xoá".
 */
export function DeleteTaskDialog({
  task,
  onCancel,
  onConfirm,
  onPauseInstead,
}: {
  task: ScheduledTask | null;
  onCancel: () => void;
  onConfirm: (task: ScheduledTask) => void;
  onPauseInstead: (task: ScheduledTask) => void;
}) {
  const runCount = task ? runsOfTask(task.id).length : 0;

  return (
    <AlertDialog open={!!task} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        {task && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Xoá tác vụ {task.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Tác vụ sẽ bị xoá cùng toàn bộ lịch sử {runCount} lần chạy. Các
                lần chạy đã lên lịch trong tương lai sẽ bị huỷ. Hành động này
                không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <p className="text-sm text-muted-foreground">
              Nếu chỉ muốn dừng tạm thời, hãy tắt tác vụ thay vì xoá.
            </p>

            <AlertDialogFooter>
              <Button variant="ghost" onClick={onCancel}>
                Huỷ
              </Button>
              {task.state === "active" && (
                <Button variant="outline" onClick={() => onPauseInstead(task)}>
                  Tắt tác vụ
                </Button>
              )}
              <Button variant="destructive" onClick={() => onConfirm(task)}>
                Xoá
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
