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
  garageTeam: GroupCategoryNames.GARAGETEAM,
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
    categoryId: 1,
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
    categoryId: 2,
    metaData,
  };
};

export const seedGroupCategories: GroupCategory[] = [
  {
    id: 1,
    name: "Network",
    groups: [],
  },
  {
    id: 2,
    name: "Cluster",
    groups: [],
  },
  {
    id: 3,
    name: "Church Location",
    groups: [],
  },
  {
    id: 4,
    name: "Cohort",
    groups: [],
  },
  {
    id: 5,
    name: "Missional Community",
    groups: [],
  },
  {
    id: 6,
    name: "Huddle",
    groups: [],
  },
  {
    id: 7,
    name: "GarageTeam",
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
