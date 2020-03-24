import { GroupPrivacy } from '../../groups/enums/groupPrivacy';
import Group from '../../groups/entities/group.entity';
import GroupCategory from '../../groups/entities/groupCategory.entity';

const createLocation = ({name, details}: { name: string; details?: string }): Group => {
  return {
    id: 0,
    parent: null,
    privacy: GroupPrivacy.Public,
    details: details,
    name: name,
    categoryId: "Location",
    members: [],
    children: []
  };
};

const createMc = ({name, details}: { name: string; details?: string }): Group => {
  return {
    id: 0,
    parent: null,
    privacy: GroupPrivacy.Public,
    details: details,
    name: name,
    categoryId: "MC",
    members: [],
    children: []
  };
};

export const seedGroupCategories: GroupCategory[] = [
  {
    name: "Location",
    details: "Church Location",
    groups: []
  },
  {
    name: "Cohort",
    details: "Group of Mcs",
    groups: []
  },
  {
    name: "MC",
    details: "Missional Community",
    groups: []
  },
  {
    name: "Huddle",
    details: "Huddle",
    groups: []
  },
  {
    name: "GarageTeam",
    details: "GarageTeam",
    groups: []
  }
];

const locations: Group[] = [
  createLocation({
    name: "WHNalya"
  }),
  createLocation({
    name: "WHKatiKati"
  }),
  createLocation({
    name: "WHDowntown"
  }),
  createLocation({
    name: "WHBugolobi"
  }),
  createLocation({
    name: "WHGayaza"
  }),
  createLocation({
    name: "WHMukono"
  }),
  createLocation({
    name: "WHJinja"
  }),
  createLocation({
    name: "WHIganga"
  }),
  createLocation({
    name: "WHEntebe"
  }),
  createLocation({
    name: "WHGabaRd"
  }),
  createLocation({
    name: "WHKungu"
  })
];

const mcNames = [
  "Kungu Music MC","New Life MC","Bread of Life Mc","Arise MC","Pathfinders MC","Kungu Family MC","Rest MC Mak",
  "Lit MC Mak","Mak Music Team Mc","Nansana MC","Kasangati MC","Mpererwe MC","Nakwero MC","Catalysts MC",
  "Kyebando MC","Manyangwa MC","Soaring Eagles MC","Music MC","Amigos MC","Magere MC","Lovers of Kawempe MC",
  "Set Her Free Foundation MC","Komamboga MC","Kagoma MC","Trailblazers MC","Caring Hands MC","Power Kids MC",
  "Epistles MC","No limits MC","Amplifiers MC","OAKS MC","Christians in action (CIA)","STOC MC","New life MC",
  "OMEGA","Konnected","Conquerors","sozo mc","Yolo Mc","Blossom MC","The invaders mc","Ithonya MC",
  "Rainbow MC","Catalyst MC","Amazing kids MC","Songbird MC","Advance MC","Baby whisperers Mc","Candies M",
  "Petros Zoe MC","Dove MC","Changers MC","Heart of A Child MC","Immovables MC","In the Vine MC",
  "Eye Openers MC","The Rock MC","Blessed Ones MC","Soweto MC","WHKibuye Music Team MC",
  "WHKibuye Harvest Kids (Facilitators) MC","Iganga MC","Knights Watch MC","Incredibles MC"];

const mcList = mcNames.map(name=>createMc({name}));
export const seedGroups = [...locations,...mcList];
