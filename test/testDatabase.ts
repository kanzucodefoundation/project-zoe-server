import { TypeOrmModule } from '@nestjs/typeorm';
import config from '../src/config';
import { usersEntities } from '../src/users/users.helpers';
import { crmEntities } from '../src/crm/crm.helpers';
import { groupEntities } from '../src/groups/groups.helpers';


export const testDatabase = TypeOrmModule.forRoot({
  type: 'mysql', ...config.database,
  entities: [
    ...usersEntities, ...crmEntities, ...groupEntities,
  ],
  logging:true
})
