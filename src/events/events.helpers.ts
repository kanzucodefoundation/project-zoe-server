import { MemberEventActivities } from './entities/member-event-activities.entity';
import GroupEvent from './entities/event.entity';
import EventCategory from './entities/eventCategory.entity';
import EventField from './entities/eventField.entity';
import EventAttendance from './entities/eventAttendance.entity';

import { EventActivity } from './entities/event-activity.entity';

import EventRegistration from './entities/eventRegistration.entity';


export const eventEntities = [
  GroupEvent,
  EventCategory,
  EventField,
  EventAttendance,

  EventActivity,
  MemberEventActivities,
  

  EventRegistration,

];
