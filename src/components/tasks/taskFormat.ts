import type { TaskItem, TaskPriority, TaskStatus } from '../../types/tasks';

export const priorityLabel = (priority: TaskPriority) => {
  if (priority === 1) return 'High';
  if (priority === 2) return 'Medium';
  return 'Low';
};

export const statusLabel = (status: TaskStatus) => {
  if (status === 'in_progress') return 'In Progress';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export const isOverdue = (task: TaskItem, today?: string) => (
  Boolean(today && task.deadline && task.deadline < today && task.status !== 'done' && task.status !== 'cancelled')
);

export const deadlineLabel = (task: TaskItem, today?: string) => {
  if (!task.deadline) return 'No deadline';
  if (today && task.deadline === today) return 'Today';
  if (isOverdue(task, today)) return `Overdue ${task.deadline}`;
  return task.deadline;
};

export const taskMeta = (task: TaskItem, today?: string) => [
  priorityLabel(task.priority),
  deadlineLabel(task, today),
  task.category || 'No category',
].filter(Boolean).join(' / ');

export const todayInManila = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
};
