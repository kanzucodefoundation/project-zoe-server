export enum ContactActivityType {
  // Retention journey
  FIRST_VISIT = 'first_visit',
  GOT_SAVED = 'got_saved',
  MATCHED_TO_FELLOWSHIP = 'matched_to_fellowship',
  ATTENDED_FELLOWSHIP = 'attended_fellowship',
  JOINED_SERVING_TEAM = 'joined_serving_team',
  GOT_BAPTISED = 'got_baptised',
  // Task lifecycle
  TASK_CREATED = 'task_created',
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  // Group lifecycle
  JOINED_GROUP = 'joined_group',
  LEFT_GROUP = 'left_group',
  // Event lifecycle
  ATTENDED_EVENT = 'attended_event',
}
