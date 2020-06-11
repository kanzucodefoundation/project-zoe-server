import { IsDateString, IsEnum, IsNotEmpty } from 'class-validator';
import ComboDto from '../../shared/dto/combo.dto';

export class CreateAppointmentDto {
  

  @IsNotEmpty()
  taskId: string;

 

  @IsDateString()
  start_date: Date;

  @IsDateString()
  end_date: Date;

  @IsNotEmpty()
  task_info: string;
  
  @IsNotEmpty()
  assigned_to: string;

}
