import { Body, Controller, Get, Post} from '@nestjs/common';
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
    async create(@Body()visitor: VisitorDto): Promise<Visitor> {
        const vis = new Visitor();

        vis.firstName = visitor.firstName;
        vis.lastName = visitor.lastName;
        vis.gender = visitor.gender;
        vis.phone = visitor.phone.trim().replace(/\s/g,'');
        vis.residence = visitor.residence.trim().replace(/^\s+|\s\s+|\s+$/g,' ');
        vis.whLocation = visitor.whLocation
	
        return await this.visitorService.create(vis);
    }

}
