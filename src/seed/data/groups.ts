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
    categoryId: GroupCategoryNames.LOCATION,
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
    categoryId: GroupCategoryNames.MC,
    metaData,
  };
};

export const seedGroupCategories: GroupCategory[] = [
  {
    id: GroupCategoryNames.NETWORK,
    name: "Network",
    groups: [],
  },
  {
    id: GroupCategoryNames.CLUSTER,
    name: "Cluster",
    groups: [],
  },
  {
    id: GroupCategoryNames.LOCATION,
    name: "Church Location",
    groups: [],
  },
  {
    id: GroupCategoryNames.COHORT,
    name: "Cohort",
    groups: [],
  },
  {
    id: GroupCategoryNames.MC,
    name: "Missional Community",
    groups: [],
  },
  {
    id: GroupCategoryNames.HUDDLE,
    name: "Huddle",
    groups: [],
  },
  {
    id: GroupCategoryNames.GARAGETEAM,
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
