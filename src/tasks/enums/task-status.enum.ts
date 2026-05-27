export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  UNREACHABLE = 'unreachable',
  // Activity-triggering statuses — each creates a ContactActivity on the person
  MATCHED_TO_FELLOWSHIP = 'matched_to_fellowship',
  ATTENDED_FELLOWSHIP = 'attended_fellowship',
  JOINED_SERVING_TEAM = 'joined_serving_team',
  GOT_BAPTISED = 'got_baptised',
}

// Statuses that cannot be moved backwards once set
export const CLOSED_STATUSES: TaskStatus[] = [
  TaskStatus.DONE,
  TaskStatus.UNREACHABLE,
];
