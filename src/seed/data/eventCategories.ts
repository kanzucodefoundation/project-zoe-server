import { FieldType } from '../../events/entities/eventField.entity';

export const eventsCategories = {
  garage: 'garage',
  evangelism: 'evangelism',
  wedding: 'wedding',
  baptism: 'baptism',
  mc: 'mc',
  frontier: 'frontier',
};

const baseReportFields = [
  {
    label: 'Praise Report',
    name: 'praiseReport',
    type: FieldType.Text,
    isRequired: true,
  },
  {
    label: 'Challenges',
    name: 'challenges',
    type: FieldType.Text,
    isRequired: true,
  },
];

const reportFields = [
  {
    label: 'No. of Salvation',
    name: 'noOfSalvations',
    type: FieldType.Number,
    isRequired: true,
  },
  ...baseReportFields,
];
const categories: any[] = [
  {
    id: eventsCategories.garage,
    name: 'Garage',
    events: [],
    fields: [
      {
        label: 'No. of Adults',
        name: 'numberOfAdults',
        type: FieldType.Number,
        isRequired: true,
      },
      {
        label: 'No. of Children',
        name: 'numberOfChildren',
        type: FieldType.Number,
        isRequired: true,
      },
      {
        label: 'No. of Teens',
        name: 'numberOfTeens',
        type: FieldType.Number,
        isRequired: true,
      },
      {
        label: 'Total Giving',
        name: 'totalGiving',
        type: FieldType.Number,
        isRequired: true,
      },
      {
        label: 'No. of Mechanics',
        name: 'noOfMechanics',
        type: FieldType.Number,
        isRequired: true,
      },
      ...reportFields,
    ],
  },
  {
    id: eventsCategories.mc,
    name: 'MC Meeting',
    events: [],
    fields: [
      {
        label: 'No. of children',
        name: 'numberOfChildren',
        type: FieldType.Number,
        isRequired: true,
      },
      {
        label: 'No. of Guests',
        name: 'numberOfGuests',
        type: FieldType.Number,
        isRequired: true,
      },
      ...reportFields,
    ],
  },
  {
    id: eventsCategories.frontier,
    name: 'Frontier',
    events: [],
    fields: [
      {
        label: 'Total Cost',
        name: 'totalCost',
        type: FieldType.Number,
        isRequired: true,
      },
      ...reportFields,
    ],
  },
  {
    id: eventsCategories.baptism,
    name: 'Baptism',
    events: [],
    fields: [
      {
        label: 'No. of Baptisms',
        name: 'noOfBaptisms',
        type: FieldType.Number,
        isRequired: true,
      },
      ...baseReportFields,
    ],
  },
  {
    id: eventsCategories.evangelism,
    name: 'Evangelism',
    events: [],
    fields: [
      {
        label: 'Re-commitments',
        name: 'noOfRecommitments',
        type: FieldType.Number,
        isRequired: true,
      },
      ...reportFields,
    ],
  },
  {
    id: eventsCategories.wedding,
    name: 'Wedding',
    events: [],
    fields: [
      {
        label: 'No. of Weddings',
        name: 'noOfWeddings',
        type: FieldType.Number,
        isRequired: true,
      },
      ...baseReportFields,
    ],
  },
];

export default categories;
