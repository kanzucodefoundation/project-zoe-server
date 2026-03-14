import { ServiceSchedule } from './entities/service-schedule.entity';
import { ServiceInstance } from './entities/service-instance.entity';
import { ServiceAttendance } from './entities/service-attendance.entity';
import { FellowshipSchedule } from './entities/fellowship-schedule.entity';
import { FellowshipInstance } from './entities/fellowship-instance.entity';
import { FellowshipAttendance } from './entities/fellowship-attendance.entity';

export const attendanceEntities = [
  ServiceSchedule,
  ServiceInstance,
  ServiceAttendance,
  FellowshipSchedule,
  FellowshipInstance,
  FellowshipAttendance,
];
