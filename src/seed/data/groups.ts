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

const createGroupObject = ({
  name,
  details,
  parentId,
  categoryName,
  metaData,
}: {
  name: string;
  details?: string;
  parentId: number | null;
  categoryName: string;
  metaData?: any;
}): CreateGroupDto => {
  return {
    parentId: parentId,
    privacy: GroupPrivacy.Public,
    details: details,
    metaData: metaData,
    name: name,
    categoryName: categoryName,
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
    name: GroupCategoryNames.ZONE,
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

const seedNetworks: CreateGroupDto[] = [];
const seedLocations: CreateGroupDto[] = [];
const seedZones: CreateGroupDto[] = [];
const seedCells: CreateGroupDto[] = [];

/**
 * Populate the seedNetworks, seedLocations, seedZones and seedCells arrays
 */
async function populateGroupArrays() {
  for (const location of mcData) {
    const newNetwork = createGroupObject({
      name: "Champions Network",
      categoryName: GroupCategoryNames.NETWORK,
      parentId: null,
    });
    const networdId = 1;
    const locationId = 2;
    const zoneId = 3;
    const newLocation = createGroupObject({
      name: location.name,
      parentId: networdId,
      categoryName: GroupCategoryNames.LOCATION,
    });
    const newZone = createGroupObject({
      name: "Najjera-Buwate Zone",
      parentId: locationId,
      categoryName: GroupCategoryNames.ZONE,
    });
    seedNetworks.push(newNetwork);
    seedZones.push(newZone);
    seedLocations.push(newLocation);
    for (const mc of location.list) {
      seedCells.push(
        createGroupObject({
          name: `${mc.name}`,
          categoryName: GroupCategoryNames.MC,
          parentId: zoneId,
          metaData: JSON.stringify({
            leaders: mc.leaders,
            phone: mc.phone,
            email: mc.email,
          }),
        }),
      );
    }
  }
}
populateGroupArrays();

const seedGroups = [
  ...seedNetworks,
  ...seedLocations,
  ...seedZones,
  ...seedCells,
];
export default seedGroups;
