import { GroupPrivacy } from '../../groups/enums/groupPrivacy';
import GroupCategory from '../../groups/entities/groupCategory.entity';
import CreateGroupDto from '../../groups/dto/create-group.dto';
import { mcData } from './mclist';

const createLocation = ({ name, id, details }: { name: string; id: number, details?: string }): CreateGroupDto => {
  return {
    id: id,
    parentId: null,
    privacy: GroupPrivacy.Public,
    details: details,
    name: name,
    categoryId: 'Location',
  };
};

export const createMc = ({ name, parentId, details, metaData }: any): CreateGroupDto => {
  return {
    id: 0,
    parentId: parentId,
    privacy: GroupPrivacy.Public,
    details: details,
    name: name,
    categoryId: 'MC',
    metaData,
  };
};

export const seedGroupCategories: GroupCategory[] = [
  {
    id: 'Location',
    name: 'Church Location',
    groups: [],
  },
  {
    id: 'Cohort',
    name: 'Group of Mcs',
    groups: [],
  },
  {
    id: 'MC',
    name: 'Missional Community',
    groups: [],
  },
  {
    id: 'Huddle',
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
  location.list.forEach(((mc: any) => {
    seedCells.push(createMc({
      name: `${location.name}-${mc.name}`,
      parentId: index + 1,
      metaData: JSON.stringify({
        leaders: mc.leaders,
        phone: mc.phone,
        email: mc.email,
      }),
    }));
  }));
});

const seedGroups = [...seedLocations, ...seedCells];
export default seedGroups;
