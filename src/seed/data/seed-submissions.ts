// Generate realistic submission data for last 8 weeks
// Mix of submitted, recent, and some overdue

const getWeeksAgo = (weeks: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - weeks * 7);
  return date.toISOString();
};

const getMondayOfWeek = (weeksAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - weeksAgo * 7);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split('T')[0];
};

// Helper to generate realistic MC attendance data
const generateMCSubmission = (
  fellowshipId: number,
  fellowshipName: string,
  memberCount: number,
  weeksAgo: number,
  submittedBy: any,
) => {
  const attendanceRate = 0.7 + Math.random() * 0.25; // 70-95% attendance
  const attendance = Math.floor(memberCount * attendanceRate);
  const visitors = Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0;

  const mcDate = getMondayOfWeek(weeksAgo);
  const submittedDate = new Date(mcDate);
  submittedDate.setDate(
    submittedDate.getDate() + Math.floor(Math.random() * 3),
  ); // Submitted 0-2 days after

  return {
    reportId: 1,
    reportName: 'MC Attendance Report',
    groupId: fellowshipId,
    groupName: fellowshipName,
    submittedAt: submittedDate.toISOString(),
    submittedBy,
    data: {
      date: mcDate,
      smallGroupName: fellowshipName,
      smallGroupId: fellowshipId,
      mcHostHome: [
        "Emmanuel's home",
        "Sarah's home",
        "David's home",
        "Grace's home",
      ][Math.floor(Math.random() * 4)],
      smallGroupNumberOfMembers: memberCount,
      mcStreamPlatform: ['YouTube Live', 'Facebook', 'Did not stream'][
        Math.floor(Math.random() * 3)
      ],
      smallGroupAttendanceCount: attendance,
      mcAttendeeNames: `${attendance} members attended`,
      mcVisitorsNames: visitors > 0 ? `${visitors} visitors` : 'No visitors',
      mcGeneralFeedback: [
        'Great fellowship time with deep discussions',
        'Powerful worship and prayer time',
        'Good engagement from everyone present',
        'Meaningful connections made',
      ][Math.floor(Math.random() * 4)],
      mcTestimonies:
        Math.random() > 0.5 ? 'Member testified of answered prayer' : '',
      mcPrayerRequest: 'Pray for upcoming outreach and unity in the group',
    },
    canEdit: weeksAgo === 0, // Only current week is editable
  };
};

// Helper for Sunday Service submissions
const generateServiceSubmission = (
  locationId: number,
  locationName: string,
  weeksAgo: number,
  submittedBy: any,
) => {
  const totalAttendance = 150 + Math.floor(Math.random() * 200); // 150-350
  const children = Math.floor(totalAttendance * 0.25);
  const adults = totalAttendance - children;
  const visitors = Math.floor(Math.random() * 15);

  const serviceDate = getMondayOfWeek(weeksAgo);
  const sunday = new Date(serviceDate);
  sunday.setDate(sunday.getDate() + 6); // Move to Sunday

  const submittedDate = new Date(sunday);
  submittedDate.setDate(submittedDate.getDate() + 1); // Submitted Monday after

  return {
    reportId: 2,
    reportName: 'Sunday Service Report',
    groupId: locationId,
    groupName: locationName,
    submittedAt: submittedDate.toISOString(),
    submittedBy,
    data: {
      serviceDate: sunday.toISOString().split('T')[0],
      serviceType: 'First Service',
      totalAttendance,
      adultsCount: adults,
      childrenCount: children,
      firstTimeVisitors: visitors,
      offering: Math.floor(500000 + Math.random() * 1500000), // UGX
      sermonTopic: [
        'Walking in Faith',
        'The Power of Prayer',
        'Living with Purpose',
        'Grace and Mercy',
        'Kingdom Perspective',
      ][Math.floor(Math.random() * 5)],
    },
    canEdit: weeksAgo === 0,
  };
};

export const submissionGenerators = {
  generateMCSubmissions: () => {
    const submissions: any[] = [];
    let submissionId = 1;

    // Kampala fellowships - 8 weeks of history
    const kampalaFellowships = [
      {
        id: 100,
        name: 'Phase MC',
        members: 8,
        leaderId: 1,
        leaderName: 'Emmanuel Okello',
      },
      {
        id: 101,
        name: 'Grace & Truth MC',
        members: 6,
        leaderId: 9,
        leaderName: 'Peter Ssemakula',
      },
      {
        id: 102,
        name: 'Victory MC',
        members: 7,
        leaderId: 23,
        leaderName: 'Simon Mukasa',
      },
      {
        id: 103,
        name: 'Overflow MC',
        members: 5,
        leaderId: 38,
        leaderName: 'Paul Ssebugwawo',
      },
      {
        id: 104,
        name: 'Brave MC',
        members: 6,
        leaderId: 40,
        leaderName: 'Andrew Ssemanda',
      },
      {
        id: 105,
        name: 'Hope MC',
        members: 5,
        leaderId: 26,
        leaderName: 'Samuel Kityo',
      },
      {
        id: 106,
        name: 'Faith MC',
        members: 6,
        leaderId: 44,
        leaderName: 'Steven Kasirye',
      },
      {
        id: 107,
        name: 'Love MC',
        members: 4,
        leaderId: 46,
        leaderName: 'Richard Lubega',
      },
      {
        id: 110,
        name: 'Kingdom MC',
        members: 6,
        leaderId: 28,
        leaderName: 'Benjamin Lutalo',
      },
    ];

    // Generate 8 weeks of submissions for each fellowship
    // 80% submission rate (some weeks missing to show "overdue" state)
    kampalaFellowships.forEach((fellowship) => {
      for (let week = 0; week < 8; week++) {
        // Skip some submissions to create realistic gaps
        if (Math.random() > 0.2) {
          // 80% submission rate
          submissions.push({
            id: submissionId++,
            ...generateMCSubmission(
              fellowship.id,
              fellowship.name,
              fellowship.members,
              week,
              { id: fellowship.leaderId, name: fellowship.leaderName },
            ),
          });
        }
      }
    });

    // Kigali fellowships - fewer submissions (newer)
    const kigaliFellowships = [
      {
        id: 120,
        name: 'New Hope MC Kigali',
        members: 3,
        leaderId: 15,
        leaderName: 'Jean Mukiza',
      },
      {
        id: 121,
        name: 'Redeemed MC',
        members: 3,
        leaderId: 30,
        leaderName: 'Patrick Habimana',
      },
      {
        id: 122,
        name: 'Chosen MC',
        members: 2,
        leaderId: 48,
        leaderName: 'Charles Nkurunziza',
      },
    ];

    kigaliFellowships.forEach((fellowship) => {
      for (let week = 0; week < 4; week++) {
        // Only 4 weeks
        if (Math.random() > 0.3) {
          // 70% submission rate
          submissions.push({
            id: submissionId++,
            ...generateMCSubmission(
              fellowship.id,
              fellowship.name,
              fellowship.members,
              week,
              { id: fellowship.leaderId, name: fellowship.leaderName },
            ),
          });
        }
      }
    });

    // Nairobi fellowships
    const nairobiFellowships = [
      {
        id: 128,
        name: 'Breakthrough MC',
        members: 3,
        leaderId: 18,
        leaderName: 'John Kamau',
      },
      {
        id: 129,
        name: 'Victory Nairobi MC',
        members: 3,
        leaderId: 50,
        leaderName: 'Kevin Njoroge',
      },
      {
        id: 132,
        name: 'Champions MC',
        members: 3,
        leaderId: 32,
        leaderName: 'Michael Otieno',
      },
    ];

    nairobiFellowships.forEach((fellowship) => {
      for (let week = 0; week < 6; week++) {
        if (Math.random() > 0.25) {
          // 75% submission rate
          submissions.push({
            id: submissionId++,
            ...generateMCSubmission(
              fellowship.id,
              fellowship.name,
              fellowship.members,
              week,
              { id: fellowship.leaderId, name: fellowship.leaderName },
            ),
          });
        }
      }
    });

    // Berlin fellowships - newest, limited history
    const berlinFellowships = [
      {
        id: 140,
        name: 'Berlin Believers MC',
        members: 2,
        leaderId: 21,
        leaderName: 'Andreas Mueller',
      },
      {
        id: 141,
        name: 'Deutschland MC',
        members: 2,
        leaderId: 34,
        leaderName: 'Thomas Wagner',
      },
    ];

    berlinFellowships.forEach((fellowship) => {
      for (let week = 0; week < 3; week++) {
        // Only 3 weeks
        if (Math.random() > 0.4) {
          // 60% submission rate (new group)
          submissions.push({
            id: submissionId++,
            ...generateMCSubmission(
              fellowship.id,
              fellowship.name,
              fellowship.members,
              week,
              { id: fellowship.leaderId, name: fellowship.leaderName },
            ),
          });
        }
      }
    });

    return submissions;
  },

  generateServiceSubmissions: () => {
    const submissions: any[] = [];
    let submissionId = 1000;

    const locations = [
      {
        id: 10,
        name: 'Kampala Location',
        leaderId: 153,
        leaderName: 'Location Pastor',
      },
      {
        id: 11,
        name: 'Kigali Location',
        leaderId: 154,
        leaderName: 'Kigali Pastor',
      },
      {
        id: 12,
        name: 'Nairobi Location',
        leaderId: 155,
        leaderName: 'Nairobi Pastor',
      },
      {
        id: 13,
        name: 'Berlin Location',
        leaderId: 156,
        leaderName: 'Berlin Pastor',
      },
    ];

    // Generate 8 weeks of Sunday service reports
    locations.forEach((location) => {
      for (let week = 0; week < 8; week++) {
        if (Math.random() > 0.1) {
          // 90% submission rate for locations
          submissions.push({
            id: submissionId++,
            ...generateServiceSubmission(location.id, location.name, week, {
              id: location.leaderId,
              name: location.leaderName,
            }),
          });
        }
      }
    });

    return submissions;
  },

  generateBaptismSubmissions: () => {
    // Sporadic baptism events
    return [
      {
        id: 2000,
        reportId: 3,
        reportName: 'Baptism Report',
        groupId: 10,
        groupName: 'Kampala Location',
        submittedAt: getWeeksAgo(2),
        submittedBy: { id: 153, name: 'Location Pastor' },
        data: {
          baptismDate: getMondayOfWeek(2),
          numberOfBaptisms: 5,
          baptizedNames:
            'John Doe, Jane Smith, Peter Okello, Mary Nakato, David Wasswa',
          baptismLocation: 'Kampala Church Building',
          officiatingMinister: 'Pastor Emmanuel',
          baptismNotes: 'Powerful baptism service with testimonies shared',
        },
        canEdit: false,
      },
      {
        id: 2001,
        reportId: 3,
        reportName: 'Baptism Report',
        groupId: 11,
        groupName: 'Kigali Location',
        submittedAt: getWeeksAgo(4),
        submittedBy: { id: 154, name: 'Kigali Pastor' },
        data: {
          baptismDate: getMondayOfWeek(4),
          numberOfBaptisms: 3,
          baptizedNames: 'Jean Baptiste, Marie Claire, Patrick Niyonzima',
          baptismLocation: 'Lake Kivu',
          officiatingMinister: 'Pastor Jean',
          baptismNotes: 'Outdoor baptism at the lake',
        },
        canEdit: false,
      },
    ];
  },

  generateSalvationSubmissions: () => {
    // Various salvation reports from MCs
    return [
      {
        id: 3000,
        reportId: 4,
        reportName: 'Salvation Report',
        groupId: 100,
        groupName: 'Phase MC',
        submittedAt: getWeeksAgo(1),
        submittedBy: { id: 1, name: 'Emmanuel Okello' },
        data: {
          salvationDate: getMondayOfWeek(1),
          numberOfSalvations: 2,
          savedNames: 'Alice Namugga, Bob Kizza',
          salvationContext: 'MC Meeting',
          followUpPlan: 'Connect with discipleship team, assign mentors',
        },
        canEdit: true,
      },
      {
        id: 3001,
        reportId: 4,
        reportName: 'Salvation Report',
        groupId: 128,
        groupName: 'Breakthrough MC',
        submittedAt: getWeeksAgo(3),
        submittedBy: { id: 18, name: 'John Kamau' },
        data: {
          salvationDate: getMondayOfWeek(3),
          numberOfSalvations: 1,
          savedNames: 'Stephen Mwangi',
          salvationContext: 'Personal Evangelism',
          followUpPlan: 'Weekly follow-up meetings scheduled',
        },
        canEdit: false,
      },
    ];
  },
};
