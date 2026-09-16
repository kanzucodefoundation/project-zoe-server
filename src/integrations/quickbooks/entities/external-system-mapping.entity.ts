import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../../tenants/entities/tenant.entity';

@Entity()
@Index(
  [
    'tenantId',
    'system',
    'internalReferenceType',
    'internalReferenceId',
    'externalReferenceType',
  ],
  { unique: true },
)
@Index(['tenantId', 'system', 'externalReferenceType', 'externalReferenceId'])
export class ExternalSystemMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @Column()
  tenantId: number;

  @Column({ type: 'varchar', length: 50 })
  system: string;

  @Column({ type: 'varchar', length: 50 })
  internalReferenceType: string;

  @Column({ type: 'varchar', length: 100 })
  internalReferenceId: string;

  @Column({ type: 'varchar', length: 50 })
  externalReferenceType: string;

  @Column({ type: 'varchar', length: 100 })
  externalReferenceId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalReferenceName: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
