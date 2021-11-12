import {
    Column,
    Entity,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn
} from 'typeorm';
import { URLCategory } from '../enums/URLCategory';

@Entity({ name: 'help' })
export default class Help {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 300 })
  title: string;

  @Column({ nullable: false})
  url?: string;

  @Column({
    type: 'enum',
    enum: URLCategory,
    nullable: true,
  })
  category: URLCategory;

  @CreateDateColumn({
    default: () => 'NOW()',
    nullable: false,
  })
  createdOn: Date;

  @UpdateDateColumn({
    default: () => 'NOW()',
    nullable: false,
  })
  modifiedOn: Date;
}
