export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export type TaskListStatus = TaskStatus | 'active' | 'all';

export type TaskPriority = 1 | 2 | 3;

export interface TaskItem {
  id: number;
  title: string;
  description: string;
  deadline: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface TaskListResponse {
  tasks: TaskItem[];
  total: number;
}

export interface TaskWidgetResponse {
  today: string;
  pending_count: number;
  in_progress_count: number;
  overdue_count: number;
  done_today_count: number;
  focus: TaskItem | null;
  top_tasks: TaskItem[];
}

export interface TaskCreateRequest {
  title: string;
  description?: string;
  deadline?: string | null;
  priority?: TaskPriority;
  category?: string;
}

export interface TaskUpdateRequest {
  title?: string;
  description?: string;
  deadline?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  category?: string;
}

export interface TaskPostponeRequest {
  to?: string | null;
}
