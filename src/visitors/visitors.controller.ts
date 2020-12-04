import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VisitorDto } from './dto/visitorDto.dto';
import { Visitor } from './entities/visitor.entity';
import { VisitorsService } from './visitors.service';

@ApiTags('Visitors')
@Controller('api/visitors')
export class VisitorsController {
    constructor (
        private readonly visitorService:VisitorsService
    ){}

    @Get()
    async findAll():Promise<Visitor[]>{
        return await this.visitorService.findAll();
    }

    //Register Visitor action
    @Post('register')
    async create(@Body()data: VisitorDto): Promise<Visitor> {
        const vis = new Visitor();
        vis.firstName = data.firstName;
        vis.lastName = data.lastName;
        vis.gender = data.gender;
        vis.phone = data.phone;
        vis.residence = data.residence;
        vis.whLocation = data.whLocation
	
        return await this.visitorService.create(vis);
    }


}
