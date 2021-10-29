import { Column } from 'typeorm';
import { Point } from '../../utils/locationHelpers';

export default class InternalAddress {
  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true })
  placeId: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'float', nullable: true })
  latitude: number;

  @Column({ type: 'float', nullable: true })
  longitude: number;

  @Column({ type: 'point', nullable: true })
  geoCoordinates?: Point | string;

  @Column({ nullable: true })
  vicinity: string;
}
