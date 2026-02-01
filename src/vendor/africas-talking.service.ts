import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface SmsSendResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  errors: string[];
}

@Injectable()
export class AfricasTalkingService {
  private readonly logger = new Logger(AfricasTalkingService.name);
  private readonly apiKey: string;
  private readonly username: string;
  private readonly baseUrl = 'https://api.africastalking.com/version1';

  constructor(private readonly httpService: HttpService) {
    this.apiKey = process.env.AFRICASTALKING_API_KEY || '';
    this.username = process.env.AFRICASTALKING_USERNAME || 'sandbox';

    if (!this.apiKey) {
      this.logger.warn(
        'AFRICASTALKING_API_KEY not set in environment variables',
      );
    }
  }

  /**
   * Send SMS to multiple recipients using Africa's Talking bulk SMS API
   * @param recipients Array of phone numbers in E.164 format (+256...)
   * @param message SMS message content
   * @returns Result with success count and errors
   */
  async sendBulkSms(
    recipients: string[],
    message: string,
  ): Promise<SmsSendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        sentCount: 0,
        failedCount: recipients.length,
        errors: ['Africa\'s Talking API key not configured'],
      };
    }

    if (recipients.length === 0) {
      return {
        success: true,
        sentCount: 0,
        failedCount: 0,
        errors: [],
      };
    }

    try {
      // Africa's Talking expects comma-separated recipients
      const to = recipients.join(',');

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/messaging`,
          new URLSearchParams({
            username: this.username,
            to,
            message,
          }).toString(),
          {
            headers: {
              apiKey: this.apiKey,
              'Content-Type': 'application/x-www-form-urlencoded',
              Accept: 'application/json',
            },
          },
        ),
      );

      // Parse Africa's Talking response
      const data = response.data;
      const messageData = data.SMSMessageData;

      if (!messageData || !messageData.Recipients) {
        this.logger.error(
          'Unexpected response format from Africa\'s Talking',
          data,
        );
        return {
          success: false,
          sentCount: 0,
          failedCount: recipients.length,
          errors: ['Unexpected API response format'],
        };
      }

      const recipientsData = messageData.Recipients;
      let sentCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      recipientsData.forEach((recipient: any) => {
        if (recipient.status === 'Success' || recipient.statusCode === 101) {
          sentCount++;
        } else {
          failedCount++;
          errors.push(
            `${recipient.number}: ${recipient.status || 'Failed'}`,
          );
        }
      });

      this.logger.log(
        `SMS sent: ${sentCount} successful, ${failedCount} failed out of ${recipients.length}`,
      );

      return {
        success: sentCount > 0,
        sentCount,
        failedCount,
        errors,
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`, error.stack);
      return {
        success: false,
        sentCount: 0,
        failedCount: recipients.length,
        errors: [error.message || 'Unknown error occurred'],
      };
    }
  }

  /**
   * Validate and normalize Uganda phone number
   * Accepts: +256XXXXXXXXX, 256XXXXXXXXX, 07XXXXXXXX, 03XXXXXXXX
   * Returns: +256XXXXXXXXX format or null if invalid
   */
  normalizePhoneNumber(phone: string): string | null {
    if (!phone) return null;

    // Remove all whitespace and special characters except +
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // Pattern 1: +256 followed by 9 digits
    if (/^\+256\d{9}$/.test(cleaned)) {
      return cleaned;
    }

    // Pattern 2: 256 followed by 9 digits (add +)
    if (/^256\d{9}$/.test(cleaned)) {
      return '+' + cleaned;
    }

    // Pattern 3: 07 or 03 followed by 8 digits (convert to +256)
    if (/^0[37]\d{8}$/.test(cleaned)) {
      return '+256' + cleaned.substring(1);
    }

    // Invalid format
    return null;
  }

  /**
   * Validate if phone number is valid Uganda format
   */
  isValidPhoneNumber(phone: string): boolean {
    return this.normalizePhoneNumber(phone) !== null;
  }
}
