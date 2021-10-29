import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Email from 'src/crm/entities/email.entity';
import { IEmail, sendEmail } from 'src/utils/mailerTest';
import { Repository } from 'typeorm';
import mailChatDto from './dto/sendMail.dto';
import { UpdateChatDto } from './dto/update-chat.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
  ) {}
  async mailAll(data: mailChatDto): Promise<void> {
    try {
      for (let i = 0; i < data.recipientId.length; i++) {
        //Select "value" from email repository given contactId or recipient ID
        const mailAddress = await this.emailRepository.find({
          select: ['value'],
          where: [{ contactId: data.recipientId[i] }],
        });
        //console.log(mailAddress[0].value); //Getting email(value) from varible
        this.sendMailToMember(mailAddress[0].value, data.subject, data.body);
      }
    } catch (error) {
      Logger.log(error);
    }
  }

  async sendMailToMember(
    to: string,
    subject: string,
    body: string,
  ): Promise<void> {
    try {
      const mailerData: IEmail = {
        to: `${to}`,
        subject: `${subject}`,
        html: `<p> ${body} </p>`,
      };
      await sendEmail(mailerData);
      Logger.log('Email sent successfully.');
    } catch (error) {
      Logger.log(error);
    }
  }

  findAll() {
    return `This action returns all chat`;
  }

  findOne(id: number) {
    return `This action returns a #${id} chat`;
  }

  update(id: number, updateChatDto: UpdateChatDto) {
    return `This action updates a #${id} chat`;
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
}
