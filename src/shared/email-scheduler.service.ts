import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class EmailSchedulerService {
  private readonly logger = new Logger(EmailSchedulerService.name);

  constructor(/*private readonly emailService: YourEmailService*/) {}

  //@Cron(CronExpression.EVERY_DAY_AT_9AM, {
  @Cron("* * * * * *", {
    timeZone: "EAT",
  })
  async sendEmailOnSchedule() {
    // Check if today is one of the specified days (Wednesday, Thursday, Friday, Saturday, or Sunday)
    const today = new Date().getDay();
    if ([0, 3, 4, 5, 6].includes(today)) {
      try {
        // Replace this with your email sending logic using your email service
        //await this.emailService.sendEmail(/* your email data */);
        this.logger.log("Email sent successfully.");
      } catch (error) {
        this.logger.error("Error sending email: " + error.message);
      }
    }
  }
}
