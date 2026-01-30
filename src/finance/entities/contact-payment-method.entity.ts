import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import Contact from '../../crm/entities/contact.entity';
import { PaymentMethodType } from '../enums/payment-method-type.enum';

@Entity()
@Index(['tenant', 'id'])
@Index(['tenant', 'valueNormalized'])
@Index(['tenant', 'contact'])
export default class ContactPaymentMethod {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant: Tenant;

  @ManyToOne(() => Contact, { nullable: false, onDelete: 'CASCADE' })
  contact: Contact;

  @Column({
    type: 'enum',
    enum: PaymentMethodType,
    default: PaymentMethodType.PHONE,
  })
  type: PaymentMethodType;

  @Column({ length: 100 })
  value: string;

  @Column({ length: 100 })
  valueNormalized: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isPrimary: boolean;

  @Column({ length: 100, nullable: true })
  label: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
