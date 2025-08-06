import EventCategory from "src/events/entities/eventCategory.entity";
import { FieldType } from "../../events/entities/eventField.entity";
import { EventCategories } from "src/events/enums/EventCategories";

const baseReportFields = [
  {
    id: 7,
    label: "Praise Report",
    name: "praiseReport",
    type: FieldType.Text,
    isRequired: true,
    order: null,
  },
  {
    id: 8,
    label: "Challenges",
    name: "challenges",
    type: FieldType.Text,
    isRequired: true,
    order: null,
  },
];

const reportFields = [
  {
    id: 6,
    label: "No. of Salvation",
    name: "noOfSalvations",
    type: FieldType.Number,
    isRequired: true,
    order: null,
  },
  ...baseReportFields,
];
const categories: EventCategory[] = [
  {
    id: 1,
    name: EventCategories.Garage,
    events: [],
    fields: [
      {
        id: 1,
        label: "No. of Adults",
        name: "numberOfAdults",
        type: FieldType.Number,
        isRequired: true,
        order: null,
      },
      {
        id: 2,
        label: "No. of Children",
        name: "numberOfChildren",
        type: FieldType.Number,
        isRequired: true,
        order: null,
      },
      {
        id: 3,
        label: "No. of Teens",
        name: "numberOfTeens",
        type: FieldType.Number,
        isRequired: true,
        order: null,
      },
      {
        id: 4,
        label: "Total Giving",
        name: "totalGiving",
        type: FieldType.Number,
        isRequired: true,
        order: null,
      },
      {
        id: 5,
        label: "No. of Mechanics",
        name: "noOfMechanics",
        type: FieldType.Number,
        isRequired: true,
        order: null,
      },
      ...reportFields,
    ],
  },
  {
    id: 2,
    name: EventCategories.MC,
    events: [],
    fields: [
      {
        id: 9,
        label: "No. of children",
        name: "numberOfChildren",
        type: FieldType.Number,
        isRequired: true,
        order: null,
      },
      {
        id: 10,
        label: "No. of Guests",
        name: "numberOfGuests",
        type: FieldType.Number,
        isRequired: true,
        order: null,
      },
      ...reportFields,
    ],
  },
  {
    id: 3,
    name: EventCategories.Frontier,
    events: [],
    fields: [
      {
        id: 11,
        label: "Total Cost",
        name: "totalCost",
        type: FieldType.Number,
        isRequired: true,
        order: null,
      },
      ...reportFields,
    ],
  },
  {
    id: 4,
    name: EventCategories.Baptism,
    events: [],
    fields: [
      {
        id: 12,
        label: "No. of Baptisms",
        name: "noOfBaptisms",
        type: FieldType.Number,
        isRequired: true,
        order: null,
      },
      ...baseReportFields,
    ],
  },
  {
    id: 5,
    name: EventCategories.Evangelism,
    events: [],
    fields: [
      {
        id: 13,
        label: "Re-commitments",
        name: "noOfRecommitments",
        type: FieldType.Number,
        isRequired: true,
        order: null,
      },
      ...reportFields,
    ],
  },
  {
    id: 6,
    name: EventCategories.Wedding,
    events: [],
    fields: [
      {
        id: 14,
        label: "No. of Weddings",
        name: "noOfWeddings",
        type: FieldType.Number,
        isRequired: true,
        order: null,
      },
      ...baseReportFields,
    ],
  },
];

export default categories;
