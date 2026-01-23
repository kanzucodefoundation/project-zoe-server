// Full 6-level hierarchy with realistic distribution
export const groupsData = {
  movement: {
    id: 1,
    name: 'Worship Harvest Global',
    type: 'movement',
    categoryId: 6,
    categoryName: 'Movement',
    parentId: null,
    privacy: 'Public',
    details: 'Global movement spanning multiple continents',
    memberCount: 0, // Calculated from children
  },

  networks: [
    {
      id: 2,
      name: 'Africa Network',
      type: 'network',
      categoryId: 5,
      categoryName: 'Network',
      parentId: 1,
      privacy: 'Public',
      details: 'African church network',
      memberCount: 0,
    },
    {
      id: 3,
      name: 'Europe Network',
      type: 'network',
      categoryId: 5,
      categoryName: 'Network',
      parentId: 1,
      privacy: 'Public',
      details: 'European church network',
      memberCount: 0,
    },
  ],

  fobs: [
    {
      id: 4,
      name: 'East Africa FOB',
      type: 'fob',
      categoryId: 4,
      categoryName: 'Forward Operating Base',
      parentId: 2,
      privacy: 'Public',
      details: 'East African forward operating base',
      memberCount: 0,
      metaData: { region: 'East Africa' },
    },
    {
      id: 5,
      name: 'Western Europe FOB',
      type: 'fob',
      categoryId: 4,
      categoryName: 'Forward Operating Base',
      parentId: 3,
      privacy: 'Public',
      details: 'Western European base',
      memberCount: 0,
      metaData: { region: 'Western Europe' },
    },
  ],

  locations: [
    // UGANDA - Kampala
    {
      id: 10,
      name: 'Kampala Location',
      type: 'location',
      categoryId: 3,
      categoryName: 'Location',
      parentId: 4,
      privacy: 'Public',
      details: 'Main Kampala church location',
      memberCount: 0,
      address: {
        country: 'Uganda',
        district: 'Kampala',
        freeForm: 'Plot 15, Ntinda Road',
      },
    },
    // RWANDA - Kigali
    {
      id: 11,
      name: 'Kigali Location',
      type: 'location',
      categoryId: 3,
      categoryName: 'Location',
      parentId: 4,
      privacy: 'Public',
      details: 'Kigali church location',
      memberCount: 0,
      address: {
        country: 'Rwanda',
        district: 'Kigali',
        freeForm: 'KN 3 Ave, Kimihurura',
      },
    },
    // KENYA - Nairobi
    {
      id: 12,
      name: 'Nairobi Location',
      type: 'location',
      categoryId: 3,
      categoryName: 'Location',
      parentId: 4,
      privacy: 'Public',
      details: 'Nairobi church location',
      memberCount: 0,
      address: {
        country: 'Kenya',
        district: 'Nairobi',
        freeForm: 'Ngong Road, Kilimani',
      },
    },
    // GERMANY - Berlin
    {
      id: 13,
      name: 'Berlin Location',
      type: 'location',
      categoryId: 3,
      categoryName: 'Location',
      parentId: 5,
      privacy: 'Public',
      details: 'Berlin church location',
      memberCount: 0,
      address: {
        country: 'Germany',
        district: 'Berlin',
        freeForm: 'Prenzlauer Allee 123',
      },
    },
  ],

  zones: [
    // KAMPALA ZONES (4 zones)
    {
      id: 20,
      name: 'North Zone Kampala',
      type: 'zone',
      categoryId: 2,
      categoryName: 'Zone',
      parentId: 10,
      privacy: 'Public',
      details: 'North Kampala zone covering Ntinda, Nakawa',
      memberCount: 0,
    },
    {
      id: 21,
      name: 'South Zone Kampala',
      type: 'zone',
      categoryId: 2,
      categoryName: 'Zone',
      parentId: 10,
      privacy: 'Public',
      details: 'South Kampala zone',
      memberCount: 0,
    },
    {
      id: 22,
      name: 'Central Zone Kampala',
      type: 'zone',
      categoryId: 2,
      categoryName: 'Zone',
      parentId: 10,
      privacy: 'Public',
      details: 'Central Kampala zone',
      memberCount: 0,
    },
    {
      id: 23,
      name: 'East Zone Kampala',
      type: 'zone',
      categoryId: 2,
      categoryName: 'Zone',
      parentId: 10,
      privacy: 'Public',
      details: 'East Kampala zone',
      memberCount: 0,
    },

    // KIGALI ZONES (2 zones)
    {
      id: 24,
      name: 'Kimihurura Zone',
      type: 'zone',
      categoryId: 2,
      categoryName: 'Zone',
      parentId: 11,
      privacy: 'Public',
      details: 'Kimihurura area zone',
      memberCount: 0,
    },
    {
      id: 25,
      name: 'Nyarutarama Zone',
      type: 'zone',
      categoryId: 2,
      categoryName: 'Zone',
      parentId: 11,
      privacy: 'Public',
      details: 'Nyarutarama area zone',
      memberCount: 0,
    },

    // NAIROBI ZONES (3 zones)
    {
      id: 26,
      name: 'Kilimani Zone',
      type: 'zone',
      categoryId: 2,
      categoryName: 'Zone',
      parentId: 12,
      privacy: 'Public',
      details: 'Kilimani area zone',
      memberCount: 0,
    },
    {
      id: 27,
      name: 'Westlands Zone',
      type: 'zone',
      categoryId: 2,
      categoryName: 'Zone',
      parentId: 12,
      privacy: 'Public',
      details: 'Westlands area zone',
      memberCount: 0,
    },
    {
      id: 28,
      name: 'Eastlands Zone',
      type: 'zone',
      categoryId: 2,
      categoryName: 'Zone',
      parentId: 12,
      privacy: 'Public',
      details: 'Eastlands area zone',
      memberCount: 0,
    },

    // BERLIN ZONES (2 zones)
    {
      id: 29,
      name: 'Prenzlauer Berg Zone',
      type: 'zone',
      categoryId: 2,
      categoryName: 'Zone',
      parentId: 13,
      privacy: 'Public',
      details: 'Prenzlauer Berg area',
      memberCount: 0,
    },
    {
      id: 30,
      name: 'Mitte Zone',
      type: 'zone',
      categoryId: 2,
      categoryName: 'Zone',
      parentId: 13,
      privacy: 'Public',
      details: 'Mitte district',
      memberCount: 0,
    },
  ],

  fellowships: [
    // NORTH ZONE KAMPALA - 5 fellowships
    { id: 100, name: 'Phase MC', parentId: 20, memberCount: 8 },
    { id: 101, name: 'Grace & Truth MC', parentId: 20, memberCount: 6 },
    { id: 102, name: 'Victory MC', parentId: 20, memberCount: 7 },
    { id: 103, name: 'Overflow MC', parentId: 20, memberCount: 5 },
    { id: 104, name: 'Brave MC', parentId: 20, memberCount: 6 },

    // SOUTH ZONE KAMPALA - 5 fellowships
    { id: 105, name: 'Hope MC', parentId: 21, memberCount: 5 },
    { id: 106, name: 'Faith MC', parentId: 21, memberCount: 6 },
    { id: 107, name: 'Love MC', parentId: 21, memberCount: 4 },
    { id: 108, name: 'Joy MC', parentId: 21, memberCount: 5 },
    { id: 109, name: 'Peace MC', parentId: 21, memberCount: 5 },

    // CENTRAL ZONE KAMPALA - 5 fellowships
    { id: 110, name: 'Kingdom MC', parentId: 22, memberCount: 6 },
    { id: 111, name: 'Lighthouse MC', parentId: 22, memberCount: 5 },
    { id: 112, name: 'Harvest MC', parentId: 22, memberCount: 4 },
    { id: 113, name: 'Salt & Light MC', parentId: 22, memberCount: 5 },
    { id: 114, name: 'Living Water MC', parentId: 22, memberCount: 5 },

    // EAST ZONE KAMPALA - 5 fellowships
    { id: 115, name: 'Fire MC', parentId: 23, memberCount: 4 },
    { id: 116, name: 'Glory MC', parentId: 23, memberCount: 5 },
    { id: 117, name: 'Remnant MC', parentId: 23, memberCount: 4 },
    { id: 118, name: 'Pioneer MC', parentId: 23, memberCount: 5 },
    { id: 119, name: 'Bread of Life MC', parentId: 23, memberCount: 4 },

    // KIGALI - KIMIHURURA ZONE - 4 fellowships
    { id: 120, name: 'New Hope MC Kigali', parentId: 24, memberCount: 3 },
    { id: 121, name: 'Redeemed MC', parentId: 24, memberCount: 3 },
    { id: 122, name: 'Chosen MC', parentId: 24, memberCount: 2 },
    { id: 123, name: 'Blessed MC', parentId: 24, memberCount: 3 },

    // KIGALI - NYARUTARAMA ZONE - 4 fellowships
    { id: 124, name: 'Covenant MC', parentId: 25, memberCount: 3 },
    { id: 125, name: 'Promise MC', parentId: 25, memberCount: 2 },
    { id: 126, name: 'Faithful MC', parentId: 25, memberCount: 3 },
    { id: 127, name: 'Destiny MC', parentId: 25, memberCount: 2 },

    // NAIROBI - KILIMANI ZONE - 4 fellowships
    { id: 128, name: 'Breakthrough MC', parentId: 26, memberCount: 3 },
    { id: 129, name: 'Victory Nairobi MC', parentId: 26, memberCount: 3 },
    { id: 130, name: 'Restoration MC', parentId: 26, memberCount: 2 },
    { id: 131, name: 'Fresh Fire MC', parentId: 26, memberCount: 3 },

    // NAIROBI - WESTLANDS ZONE - 4 fellowships
    { id: 132, name: 'Champions MC', parentId: 27, memberCount: 3 },
    { id: 133, name: 'Warriors MC', parentId: 27, memberCount: 2 },
    { id: 134, name: 'Ambassadors MC', parentId: 27, memberCount: 3 },
    { id: 135, name: 'Eagles MC', parentId: 27, memberCount: 3 },

    // NAIROBI - EASTLANDS ZONE - 4 fellowships
    { id: 136, name: 'Rising Stars MC', parentId: 28, memberCount: 2 },
    { id: 137, name: 'New Generation MC', parentId: 28, memberCount: 3 },
    { id: 138, name: 'Heritage MC', parentId: 28, memberCount: 2 },
    { id: 139, name: 'Legacy MC', parentId: 28, memberCount: 3 },

    // BERLIN - PRENZLAUER BERG ZONE - 3 fellowships
    { id: 140, name: 'Berlin Believers MC', parentId: 29, memberCount: 2 },
    { id: 141, name: 'Deutschland MC', parentId: 29, memberCount: 2 },
    { id: 142, name: 'New Life Berlin MC', parentId: 29, memberCount: 2 },

    // BERLIN - MITTE ZONE - 3 fellowships
    { id: 143, name: 'City Center MC', parentId: 30, memberCount: 2 },
    { id: 144, name: 'Crossroads MC', parentId: 30, memberCount: 2 },
    { id: 145, name: 'Gateway MC', parentId: 30, memberCount: 2 },
  ].map((f) => ({
    ...f,
    type: 'fellowship',
    categoryId: 1,
    categoryName: 'Missional Community',
    privacy: 'Public',
    details: 'Weekly fellowship meeting',
    metaData: {
      meetingDay: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'][
        Math.floor(Math.random() * 4)
      ],
      meetingTime: '19:00',
    },
  })),
};
