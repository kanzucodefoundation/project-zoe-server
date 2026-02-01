import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Connection, In, Repository } from 'typeorm';
import { ReportSubmission } from '../reports/entities/report.submission.entity';
import { Report } from '../reports/entities/report.entity';
import { GroupPermissionsService } from '../groups/services/group-permissions.service';
import Group from '../groups/entities/group.entity';
import Person from '../crm/entities/person.entity';
import Contact from '../crm/entities/contact.entity';
import { TenantContext } from '../shared/tenant/tenant-context';
import { ContactCategory } from '../crm/enums/contactCategory';

@Injectable()
export class DashboardService {
  private readonly reportSubmissionRepository: Repository<ReportSubmission>;
  private readonly reportRepository: Repository<Report>;
  private readonly groupRepository: Repository<Group>;
  private readonly personRepository: Repository<Person>;
  private readonly contactRepository: Repository<Contact>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private groupPermissionsService: GroupPermissionsService,
    private readonly tenantContext: TenantContext,
  ) {
    this.reportSubmissionRepository =
      connection.getRepository(ReportSubmission);
    this.reportRepository = connection.getRepository(Report);
    this.groupRepository = connection.getRepository(Group);
    this.personRepository = connection.getRepository(Person);
    this.contactRepository = connection.getRepository(Contact);
  }

  async getSundayServiceSummary(
    user: any,
    timeRange: string = 'month',
    groupId?: number,
  ): Promise<any> {
    // Get user's accessible groups
    const userGroupIds =
      await this.groupPermissionsService.getUserGroupIds(user);

    // Get date range based on timeRange parameter
    const { startDate, endDate } = this.getDateRange(timeRange);

    // Find the Sunday Service report
    const sundayServiceReport = await this.reportRepository.findOne({
      where: { name: 'Sunday Service Report' }, //@TODO This is too fragile. We need to use something else - probably a report category
      relations: ['fields'],
    });

    if (!sundayServiceReport) {
      throw new NotFoundException('Sunday Service Report not found');
    }

    // Get submissions for this report
    const where: any = {
      report: { id: sundayServiceReport.id },
    };

    // Filter by specific group if provided, otherwise use user's accessible groups
    if (groupId) {
      // Verify user has access to this group
      if (userGroupIds.includes(groupId)) {
        // Get the selected group and all its descendants
        const groupIdsToFilter = await this.getGroupAndDescendantIds(groupId);
        // Only include groups the user has access to
        const allowedGroupIds = groupIdsToFilter.filter((id) =>
          userGroupIds.includes(id),
        );
        where.group = { id: In(allowedGroupIds) };
      }
    } else if (userGroupIds.length > 0) {
      where.group = { id: In(userGroupIds) };
    }

    const submissions = await this.reportSubmissionRepository.find({
      where,
      relations: [
        'submissionData',
        'submissionData.reportField',
        'user',
        'user.contact',
        'user.contact.person',
        'group',
      ],
      order: { submittedAt: 'DESC' },
    });

    // Filter by date range
    const filteredSubmissions = submissions.filter(
      (s) => s.submittedAt >= startDate && s.submittedAt <= endDate,
    );

    // Calculate aggregated metrics
    const metrics = this.calculateSundayServiceMetrics(filteredSubmissions);

    // Get recent submissions (last 10)
    const recentSubmissions = this.formatRecentSubmissions(
      filteredSubmissions.slice(0, 10),
    );

    return {
      timeRange: {
        label: this.getTimeRangeLabel(timeRange),
        startDate,
        endDate,
      },
      metrics,
      recentSubmissions,
      totalSubmissions: filteredSubmissions.length,
    };
  }

  private calculateSundayServiceMetrics(
    submissions: ReportSubmission[],
  ): any {
    const serviceFields = [
      'firstService',
      'secondService',
      'yxp',
      'kids',
      'local',
      'hostingCenter1',
      'hostingCenter2',
    ];

    const numericFields = [
      ...serviceFields,
      'visitors',
      'salvations',
      'baptisms',
    ];

    if (submissions.length === 0) {
      return {
        summary: {
          avgAttendance: 0,
          totalVisitors: 0,
          salvations: 0,
          baptisms: 0,
        },
        firstService: 0,
        secondService: 0,
        yxp: 0,
        kids: 0,
        local: 0,
        hostingCenter1: 0,
        hostingCenter2: 0,
        overall: 0,
      };
    }

    // Initialize totals
    const totals: Record<string, number> = {};
    numericFields.forEach((field) => (totals[field] = 0));

    // Sum up all submission values
    submissions.forEach((submission) => {
      submission.submissionData.forEach((data) => {
        const fieldName = data.reportField.name;
        if (numericFields.includes(fieldName)) {
          totals[fieldName] += parseInt(data.fieldValue) || 0;
        }
      });
    });

    // Calculate overall (sum of service fields only)
    const overall = serviceFields.reduce(
      (sum, field) => sum + totals[field],
      0,
    );

    // Calculate average attendance per submission
    const avgAttendance = Math.round(overall / submissions.length);

    return {
      summary: {
        avgAttendance,
        totalVisitors: totals.visitors || 0,
        salvations: totals.salvations || 0,
        baptisms: totals.baptisms || 0,
      },
      firstService: totals.firstService,
      secondService: totals.secondService,
      yxp: totals.yxp,
      kids: totals.kids,
      local: totals.local,
      hostingCenter1: totals.hostingCenter1,
      hostingCenter2: totals.hostingCenter2,
      overall,
    };
  }

  private formatRecentSubmissions(submissions: ReportSubmission[]): any[] {
    const numericFields = [
      'firstService',
      'secondService',
      'yxp',
      'kids',
      'local',
      'hostingCenter1',
      'hostingCenter2',
    ];

    return submissions.map((submission) => {
      // Build data object from submission data
      const data: Record<string, number> = {};
      numericFields.forEach((field) => (data[field] = 0));

      submission.submissionData.forEach((sd) => {
        if (numericFields.includes(sd.reportField.name)) {
          data[sd.reportField.name] = parseInt(sd.fieldValue) || 0;
        }
      });

      const total = numericFields.reduce(
        (sum, field) => sum + data[field],
        0,
      );

      return {
        date: submission.submittedAt,
        ...data,
        total,
      };
    });
  }

  private getDateRange(timeRange: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case '3months':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 1);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  private getTimeRangeLabel(timeRange: string): string {
    switch (timeRange) {
      case 'week':
        return 'Past 7 Days';
      case 'month':
        return 'Past Month';
      case '3months':
        return 'Past 3 Months';
      default:
        return 'Past Month';
    }
  }

  /**
   * Get a group ID and all its descendant group IDs recursively.
   * Works with any level of hierarchy (FOB -> Location, or any parent -> children structure).
   */
  private async getGroupAndDescendantIds(groupId: number): Promise<number[]> {
    const ids: number[] = [groupId];

    const collectDescendants = async (parentId: number) => {
      const children = await this.groupRepository.find({
        where: { parentId },
        select: ['id'],
      });

      for (const child of children) {
        ids.push(child.id);
        await collectDescendants(child.id);
      }
    };

    await collectDescendants(groupId);
    return ids;
  }

  /**
   * Get birthdays for the current week (today through next 6 days).
   * Returns people sorted by birthday date (earliest first).
   * Handles edge cases: month boundaries, year boundaries, missing data.
   */
  async getBirthdaysThisWeek(): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get tenant from context
    const tenantId = this.tenantContext.requireTenant();

    // Get all contacts with people and birthdays for this tenant
    const contacts = await this.contactRepository.find({
      where: {
        tenant: { id: tenantId },
        category: ContactCategory.Person,
      },
      relations: ['person'],
      select: {
        id: true,
        person: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
        },
      },
    });

    // Filter contacts that have person with dateOfBirth
    const peopleWithBirthdays = contacts
      .filter((contact) => contact.person?.dateOfBirth)
      .map((contact) => contact.person);

    // Filter for birthdays in the current week (comparing month and day only)
    const birthdaysThisWeek = peopleWithBirthdays
      .map((person) => {
        try {
          const dob = new Date(person.dateOfBirth);

          // Validate date
          if (isNaN(dob.getTime())) {
            return null;
          }

          const birthMonth = dob.getMonth();
          const birthDay = dob.getDate();

          // Check each day from today to end of week (today + 6 days = 7 days total)
          for (let i = 0; i <= 6; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + i);

            if (
              checkDate.getMonth() === birthMonth &&
              checkDate.getDate() === birthDay
            ) {
              // Create upcoming date in current year
              const upcomingDate = new Date(checkDate);
              upcomingDate.setHours(0, 0, 0, 0);

              return {
                id: person.id,
                name: `${person.firstName} ${person.lastName}`,
                dateOfBirth: person.dateOfBirth,
                upcomingDate: upcomingDate.toISOString().split('T')[0], // YYYY-MM-DD format
                _sortDate: upcomingDate, // For internal sorting
              };
            }
          }
          return null;
        } catch (error) {
          // Handle gracefully - invalid date formats are excluded
          return null;
        }
      })
      .filter((item) => item !== null) // Remove nulls
      .sort((a, b) => a._sortDate.getTime() - b._sortDate.getTime()) // Sort by upcoming date
      .map(({ _sortDate, ...birthday }) => birthday); // Remove internal sort field

    return { birthdays: birthdaysThisWeek };
  }
}
