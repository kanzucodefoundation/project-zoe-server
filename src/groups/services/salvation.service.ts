import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SalvationRecord } from "../../crm/entities/salvation.entity";
import {
  CreateSalvationRecordDto,
  SalvationRecordWithMatches,
} from "../../crm/dto/salvation.dto";

@Injectable()
export class SalvationService {
  constructor(
    @InjectRepository(SalvationRecord)
    private salvationRepository: Repository<SalvationRecord>,
  ) {}

  async create(createDto: CreateSalvationRecordDto): Promise<SalvationRecord> {
    const record = this.salvationRepository.create(createDto);
    return await this.salvationRepository.save(record);
  }

  async findAll(): Promise<SalvationRecordWithMatches[]> {
    const records = await this.salvationRepository.find();
    return this.findMatchingRecords(records);
  }

  private findMatchingRecords(
    records: SalvationRecord[],
  ): SalvationRecordWithMatches[] {
    const duplicateMap = new Map<string, SalvationRecord[]>();

    // Group records by name and phone combination
    records.forEach((record) => {
      const key = `${record.fullName.toLowerCase()}_${record.phoneNumber}`;
      if (!duplicateMap.has(key)) {
        duplicateMap.set(key, []);
      }
      duplicateMap.get(key)?.push(record);
    });

    // Add matching record IDs to each record
    return records.map((record) => {
      const key = `${record.fullName.toLowerCase()}_${record.phoneNumber}`;
      const matches = duplicateMap.get(key) || [];

      if (matches.length > 1) {
        return {
          ...record,
          matchingRecords: matches
            .filter((match) => match.id !== record.id)
            .map((match) => match.id),
        };
      }

      return record;
    });
  }

  async findOne(id: string): Promise<SalvationRecord> {
    return await this.salvationRepository.findOne({ where: { id } });
  }
}
