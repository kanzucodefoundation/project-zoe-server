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
@Index(['tenantId', 'system'], { unique: true })
export class ExternalSystemConnection {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @Column()
  tenantId: number;

  @Column({ type: 'varchar', length: 50 })
  system: string;

  @Column({ type: 'varchar', length: 20 })
  environment: 'sandbox' | 'production';

  @Column({ type: 'varchar', length: 100, nullable: true })
  realmId: string;

  @Column({ type: 'text' })
  accessToken: string;

  @Column({ type: 'text' })
  refreshToken: string;

  @Column({ type: 'timestamptz' })
  accessTokenExpiresAt: Date;

  @Column({ type: 'timestamptz' })
  refreshTokenExpiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
