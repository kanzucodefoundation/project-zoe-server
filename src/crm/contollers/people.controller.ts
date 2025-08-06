import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  Inject,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ContactsService } from "../contacts.service";
import Person from "../entities/person.entity";
import { Repository, Connection, Brackets } from "typeorm";
import { ContactSearchDto } from "../dto/contact-search.dto";
import { CreatePersonDto } from "../dto/create-person.dto";
import { getPersonFullName } from "../crm.helpers";
import { hasValue } from "src/utils/validation";
import { FileInterceptor } from "@nestjs/platform-express";
import PersonListDto from "../dto/person-list.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { User } from "../../users/entities/user.entity";
import ContactListDto from "../dto/contact-list.dto";
import { PersonEditDto } from "../dto/person-edit.dto";
import { SentryInterceptor } from "src/utils/sentry.interceptor";

@UseInterceptors(SentryInterceptor)
@ApiTags("Crm People")
@Controller("api/crm/people")
@UseGuards(JwtAuthGuard)
export class PeopleController {
  private readonly personRepository: Repository<Person>;
  private readonly userRepository: Repository<User>;

  constructor(
    @Inject("CONNECTION") connection: Connection,
    private readonly service: ContactsService,
  ) {
    this.personRepository = connection.getRepository(Person);
    this.userRepository = connection.getRepository(User);
  }

  @Get()
  async findAll(@Query() req: ContactSearchDto): Promise<Person[]> {
    const query = this.personRepository.createQueryBuilder("person");

    if (hasValue(req.query)) {
      query.where(
        new Brackets((qb) => {
          qb.where("person.firstName LIKE :query", { query: `%${req.query}%` });
          qb.orWhere("person.middleName LIKE :query", {
            query: `%${req.query}%`,
          });
          qb.orWhere("person.lastName LIKE :query", {
            query: `%${req.query}%`,
          });
        }),
      );
    }

    query.skip(req.skip).take(req.limit);

    return await query.getMany();
  }

  @Get("combo")
  async findCombo(@Query() req: ContactSearchDto): Promise<PersonListDto[]> {
    const query = this.personRepository.createQueryBuilder("person");

    if (hasValue(req.query)) {
      query
        .select([
          "person.id",
          "person.firstName",
          "person.lastName",
          "person.middleName",
          "person.avatar",
          "person.contactId",
        ])
        .where(
          new Brackets((qb) => {
            qb.where("person.firstName LIKE :query", {
              query: `%${req.query}%`,
            });
            qb.orWhere("person.middleName LIKE :query", {
              query: `%${req.query}%`,
            });
            qb.orWhere("person.lastName LIKE :query", {
              query: `%${req.query}%`,
            });
          }),
        );
    }

    query.skip(req.skip).take(req.limit);

    let data = await query.getMany();

    if (req.skipUsers) {
      const users = await this.userRepository.find({
        where: {},
        select: ["contactId"],
      });
      const idList = users.map((it) => it.contactId);
      data = data.filter((it) => idList.indexOf(it.contactId) < 0);
    }
    return data.map((it) => ({
      id: it.contactId,
      name: getPersonFullName(it),
      avatar: it.avatar,
    }));
  }

  @Post()
  async create(@Body() data: CreatePersonDto): Promise<ContactListDto> {
    const created = await this.service.createPerson(data);
    const contact = await this.service.findOne(created.id);
    return ContactsService.toListDto(contact);
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(@UploadedFile() file) {
    console.log(file);
  }

  @Put()
  async update(@Body() { id, ...data }: PersonEditDto): Promise<Person> {
    await this.personRepository
      .createQueryBuilder()
      .update()
      .set({
        ...data,
      })
      .where("id = :id", { id })
      .execute();
    return await this.personRepository.findOne({ where: { id } });
  }
}
