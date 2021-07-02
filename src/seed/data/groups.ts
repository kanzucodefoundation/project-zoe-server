import { GroupPrivacy } from '../../groups/enums/groupPrivacy';
import GroupCategory from '../../groups/entities/groupCategory.entity';
import CreateGroupDto from '../../groups/dto/create-group.dto';
import { mcData } from './mclist';

export const groupConstants = {
  mc: 'MC',
  cluster: 'Cluster',
  location: 'Location',
  zone: 'Zone',
  cohort: 'Cohort',
  huddle: 'Huddle',
  garageTeam: 'GarageTeam',
};

const createLocation = ({
  name,
  id,
  details,
}: {
  name: string;
  id: number;
  details?: string;
}): CreateGroupDto => {
  return {
    id: id,
    parentId: null,
    privacy: GroupPrivacy.Public,
    details: details,
    name: name,
    categoryId: groupConstants.location,
  };
};

export const createMc = ({
  name,
  parentId,
  details,
  metaData,
}: any): CreateGroupDto => {
  return {
    id: 0,
    parentId: parentId,
    privacy: GroupPrivacy.Public,
    details: details,
    name: name,
    categoryId: groupConstants.mc,
    metaData,
  };
};

export const seedGroupCategories: Partial<GroupCategory>[] = [
  {
    id: groupConstants.cluster,
    name: 'Cluster',
    groups: [],
  },
  {
    id: groupConstants.location,
    name: 'Church Location',
    groups: [],
  },
  {
    id: groupConstants.cohort,
    name: 'Cohort',
    groups: [],
  },
  {
    id: groupConstants.mc,
    name: 'Missional Community',
    groups: [],
  },
  {
    id: groupConstants.huddle,
    name: 'Huddle',
    groups: [],
  },
  {
    id: 'GarageTeam',
    name: 'GarageTeam',
    groups: [],
  },
];

const seedLocations: CreateGroupDto[] = [];
const seedCells: CreateGroupDto[] = [];

mcData.forEach((location: any, index: number) => {
  const id = index + 1;
  const loc = createLocation({ name: location.name, id });
  seedLocations.push(loc);
  location.list.forEach((mc: any) => {
    seedCells.push(
      createMc({
        name: `${location.name}-${mc.name}`,
        parentId: index + 1,
        metaData: JSON.stringify({
          leaders: mc.leaders,
          phone: mc.phone,
          email: mc.email,
        }),
      }),
    );
  });
});

const seedGroups = [...seedLocations, ...seedCells];
export default seedGroups;
