import { Injectable, Inject } from '@nestjs/common';
import { Repository, Connection } from 'typeorm';
import { ContactActivity } from './entities/contact-activity.entity';
import { ContactActivityType } from './enums/contact-activity-type.enum';

@Injectable()
export class ContactActivityService {
  private readonly repository: Repository<ContactActivity>;

  constructor(@Inject('CONNECTION') connection: Connection) {
    this.repository = connection.getRepository(ContactActivity);
  }

  async record(params: {
    tenantId: number;
    contactId: number;
    type: ContactActivityType;
    summary: string;
    occurredAt: Date;
    recordedById?: number;
    referenceTable?: string;
    referenceId?: number;
  }): Promise<ContactActivity> {
    const activity = this.repository.create({
      tenant: { id: params.tenantId } as any,
      contact: { id: params.contactId } as any,
      type: params.type,
      summary: params.summary,
      occurredAt: params.occurredAt,
      recordedBy: params.recordedById ? ({ id: params.recordedById } as any) : null,
      referenceTable: params.referenceTable ?? null,
      referenceId: params.referenceId ?? null,
    });
    return this.repository.save(activity);
  }

  async findForContact(tenantId: number, contactId: number): Promise<ContactActivity[]> {
    return this.repository.find({
      where: {
        tenant: { id: tenantId },
        contact: { id: contactId },
      },
      order: { occurredAt: 'DESC' },
    });
  }
}
