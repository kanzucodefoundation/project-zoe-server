import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { SalvationService } from "../../groups/services/salvation.service";
import { CreateSalvationRecordDto } from "../dto/salvation.dto";

@Controller("api/salvation-records")
export class SalvationController {
  constructor(private readonly salvationService: SalvationService) {}

  @Post()
  create(@Body() createDto: CreateSalvationRecordDto) {
    return this.salvationService.create(createDto);
  }

  @Get()
  async findAll() {
    const result = await this.salvationService.findAll();
    console.log(`Returning ${result} records`);
    return result;
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.salvationService.findOne(id);
  }
}
