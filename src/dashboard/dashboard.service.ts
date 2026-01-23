import { Injectable, Inject } from '@nestjs/common';
import { Connection, Repository } from 'typeorm';
import { ReportSubmission } from '../reports/entities/report.submission.entity';
import Group from '../groups/entities/group.entity';
import Contact from '../crm/entities/contact.entity';
import { GroupPermissionsService } from '../groups/services/group-permissions.service';

@Injectable()
export class DashboardService {
  private readonly reportSubmissionRepository: Repository<ReportSubmission>;
  private readonly groupRepository: Repository<Group>;
  private readonly contactRepository: Repository<Contact>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private groupPermissionsService: GroupPermissionsService,
  ) {
    this.reportSubmissionRepository =
      connection.getRepository(ReportSubmission);
    this.groupRepository = connection.getRepository(Group);
    this.contactRepository = connection.getRepository(Contact);
  }

  async getSummary(user: any): Promise<any> {
    // Get groups the user has access to
    const userGroupIds =
      await this.groupPermissionsService.getUserGroupIds(user);

    // Get primary group for user
    const primaryGroup = await this.getPrimaryGroup(userGroupIds);

    // Get weekly metrics
    const thisWeek = await this.getWeeklyMetrics(userGroupIds, 0);
    const lastWeek = await this.getWeeklyMetrics(userGroupIds, 1);

    const summary = {
      overview: {
        totalGroups: userGroupIds.length,
        totalMembers: await this.getTotalMembers(userGroupIds),
        reportsSubmitted: await this.getReportsSubmittedCount(userGroupIds),
        reportsOverdue: await this.getOverdueReportsCount(userGroupIds),
      },
      thisWeek,
      lastWeek,
      trend: {
        attendanceChange: thisWeek.attendance - lastWeek.attendance,
        visitorsChange: thisWeek.visitors - lastWeek.visitors,
      },
      group: primaryGroup,
      pendingReports: await this.getPendingReports(userGroupIds),
      recentActivity: await this.getRecentActivity(userGroupIds),
      upcomingDeadlines: await this.getUpcomingDeadlines(userGroupIds),
    };

    return summary;
  }

  private async getTotalMembers(groupIds: number[]): Promise<number> {
    if (groupIds.length === 0) return 0;

    // This is a simplified count - implement proper member counting logic
    const groups = await this.groupRepository.findByIds(groupIds);
    return groups.reduce(
      (total, group) => total + (group.members?.length || 0),
      0,
    );
  }

  private async getReportsSubmittedCount(groupIds: number[]): Promise<number> {
    if (groupIds.length === 0) return 0;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return this.reportSubmissionRepository.count({
      where: {
        submittedAt: oneWeekAgo,
        // Add groupId filter when available
      },
    });
  }

  private async getOverdueReportsCount(groupIds: number[]): Promise<number> {
    // Mock implementation - replace with real overdue calculation
    return Math.floor(groupIds.length * 0.2); // Assume 20% are overdue
  }

  private async getRecentActivity(groupIds: number[]): Promise<any[]> {
    if (groupIds.length === 0) return [];

    const recentSubmissions = await this.reportSubmissionRepository.find({
      relations: ['report', 'user'],
      order: { submittedAt: 'DESC' },
      take: 5,
    });

    return recentSubmissions.map((submission) => ({
      type: 'report_submission',
      description: `${submission.user?.username || 'Someone'} submitted ${
        submission.report?.name || 'a report'
      }`,
      timestamp: submission.submittedAt,
      userId: submission.user?.id,
      reportId: submission.report?.id,
    }));
  }

  private async getUpcomingDeadlines(groupIds: number[]): Promise<any[]> {
    // Mock upcoming deadlines - implement real deadline logic
    const mockDeadlines = [
      {
        type: 'weekly_report',
        title: 'Weekly MC Report',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        groupsCount: Math.min(5, groupIds.length),
      },
      {
        type: 'monthly_report',
        title: 'Monthly Service Report',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        groupsCount: Math.min(3, groupIds.length),
      },
    ];

    return mockDeadlines;
  }

  private async getPrimaryGroup(groupIds: number[]): Promise<any> {
    if (groupIds.length === 0) return null;

    // Get the first group or implement logic to determine primary group
    const group = await this.groupRepository.findOne({
      where: { id: groupIds[0] },
      relations: ['members', 'category'],
    });

    if (!group) return null;

    return {
      id: group.id,
      name: group.name,
      type: group.category?.name || 'Missional Community',
      memberCount: group.members?.length || 0,
      activeMembers: group.members?.length || 0, // Assume all members are active for now
    };
  }

  private async getWeeklyMetrics(
    groupIds: number[],
    weeksAgo: number,
  ): Promise<any> {
    // Calculate date range for the week
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - weeksAgo * 7);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    // Mock weekly metrics - implement real queries based on your report structure
    return {
      attendance: 45 - weeksAgo * 3, // Mock decreasing attendance
      visitors: 8 - weeksAgo * 3,
      newMembers: 2 - weeksAgo,
      salvations: weeksAgo === 0 ? 1 : 0,
      baptisms: weeksAgo === 1 ? 1 : 0,
    };
  }

  private async getPendingReports(groupIds: number[]): Promise<string[]> {
    // Mock pending reports - implement real logic based on your reports system
    const mockPendingReports = [
      'MC Attendance Report',
      'Sunday Service Report',
    ];

    return groupIds.length > 0 ? mockPendingReports : [];
  }
}
