export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export type PlanTask = {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  owner: string;
  status: TaskStatus;
  milestone: "foundation" | "assets" | "publisher" | "monitoring";
};

export const NEWV2_TASKS: PlanTask[] = [
  { id: "nv2-001", title: "Scaffold route /newv2 + split domain cards", priority: "P0", owner: "frontend", status: "done", milestone: "foundation" },
  { id: "nv2-002", title: "Create monitoring checklist board", priority: "P0", owner: "frontend", status: "done", milestone: "foundation" },
  { id: "nv2-003", title: "Create /newv2/assets step skeleton", priority: "P1", owner: "frontend", status: "done", milestone: "assets" },
  { id: "nv2-004", title: "Create /newv2/publisher wizard skeleton", priority: "P1", owner: "frontend", status: "done", milestone: "publisher" },
  { id: "nv2-005", title: "Create /newv2/monitoring board", priority: "P1", owner: "frontend", status: "done", milestone: "monitoring" },
  { id: "nv2-006", title: "Integrate realtime metrics from runs API", priority: "P2", owner: "fullstack", status: "done", milestone: "monitoring" },
  { id: "nv2-007", title: "Asset flow action wiring to existing APIs", priority: "P2", owner: "fullstack", status: "done", milestone: "assets" },
  { id: "nv2-008", title: "Publisher job creation wiring to queue APIs", priority: "P2", owner: "fullstack", status: "done", milestone: "publisher" },
  { id: "nv2-009", title: "Extract reusable stepper/wizard component for Assets & Publisher", priority: "P2", owner: "frontend", status: "done", milestone: "foundation" },
  { id: "nv2-010", title: "A/B test copy short vs long for Assets/Publisher headers", priority: "P2", owner: "frontend", status: "done", milestone: "assets" },
  { id: "nv2-011", title: "Track KPI UX (time-to-first-job, clicks, completion rate)", priority: "P2", owner: "fullstack", status: "done", milestone: "monitoring" },
  { id: "nv2-012", title: "Create UI snapshot before/after for quick review", priority: "P1", owner: "frontend", status: "done", milestone: "foundation" },
];

export function summarizeTasks(tasks: PlanTask[]) {
  const done = tasks.filter((task) => task.status === "done").length;
  const inProgress = tasks.filter((task) => task.status === "in_progress").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const todo = tasks.filter((task) => task.status === "todo").length;
  const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
  return { done, inProgress, blocked, todo, total: tasks.length, progress };
}

export function statusToBadge(status: TaskStatus): "pending" | "active" | "failed" | "completed" {
  if (status === "done") return "completed";
  if (status === "in_progress") return "active";
  if (status === "blocked") return "failed";
  return "pending";
}
