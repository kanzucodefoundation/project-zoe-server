import { GroupPrivacy } from "../../groups/enums/groupPrivacy";
import GroupCategory from "../../groups/entities/groupCategory.entity";
import CreateGroupDto from "../../groups/dto/create-group.dto";
import { mcData } from "./mclist";
import { GroupCategoryNames } from "src/groups/enums/groups";

export const groupConstants = {
  mc: GroupCategoryNames.MC,
  cluster: GroupCategoryNames.CLUSTER,
  location: GroupCategoryNames.LOCATION,
  zone: GroupCategoryNames.ZONE,
  cohort: GroupCategoryNames.COHORT,
  network: GroupCategoryNames.NETWORK,
  huddle: GroupCategoryNames.HUDDLE,
  garageTeam: GroupCategoryNames.GARAGE_TEAM,
};

const createLocation = ({
  name,
  details,
}: {
  name: string;
  details?: string;
}): CreateGroupDto => {
  return {
    parentId: null,
    privacy: GroupPrivacy.Public,
    details: details,
    name: name,
    categoryName: GroupCategoryNames.LOCATION,
  };
};

export const createMc = ({
  name,
  parentId,
  details,
  metaData,
}: any): CreateGroupDto => {
  return {
    parentId: parentId,
    privacy: GroupPrivacy.Public,
    details: details,
    name: name,
    categoryName: GroupCategoryNames.MC,
    metaData,
  };
};

export const seedGroupCategories: GroupCategory[] = [
  {
    id: 1,
    name: GroupCategoryNames.NETWORK,
    groups: [],
  },
  {
    id: 2,
    name: GroupCategoryNames.CLUSTER,
    groups: [],
  },
  {
    id: 3,
    name: GroupCategoryNames.LOCATION,
    groups: [],
  },
  {
    id: 4,
    name: GroupCategoryNames.COHORT,
    groups: [],
  },
  {
    id: 5,
    name: GroupCategoryNames.MC,
    groups: [],
  },
  {
    id: 6,
    name: GroupCategoryNames.HUDDLE,
    groups: [],
  },
  {
    id: 7,
    name: GroupCategoryNames.GARAGE_TEAM,
    groups: [],
  },
];

const seedLocations: CreateGroupDto[] = [];
const seedCells: CreateGroupDto[] = [];

mcData.forEach((location: any, index: number) => {
  const id = index + 1;

  const loc = createLocation({ name: location.name });
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
