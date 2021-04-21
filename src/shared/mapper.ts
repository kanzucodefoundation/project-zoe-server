/* 
export const toTodoDto = (data: TodoEntity): TodoDto => {
  const { id, name, description, tasks, owner } = data;

  let todoDto: TodoDto = {
    id,
    name,
    description,
    owner: owner ? toUserDto(owner) : null,
  };

  if (tasks) {
    todoDto = {
      ...todoDto,
      tasks: tasks.map((task: TaskEntity) => toTaskDto(task)),
    };
  }

  return todoDto;
};
*/

import { EventCategoryDto } from "src/events/dto/event-category.dto";
import EventFieldDto from "src/events/dto/event-field.dto";
import EventCategory from "src/events/entities/eventCategory.entity";
import EventField from "src/events/entities/eventField.entity";

export const toCategoryDto = (data: EventCategory): EventCategoryDto =>{
    const {id, name, fields} = data;

    let tocategoryDto: EventCategoryDto = {
        id,
        name,
    };

    if (fields) {
        tocategoryDto = {
            ...tocategoryDto,
            fields: fields.map((field: EventField) => toFieldDto(field)),
        };
    }

    return tocategoryDto;
}

export const toFieldDto = (data: EventField): EventFieldDto => {
    const {id,name, label, details, type, isRequired, categoryId} = data;

    let fieldDto : EventFieldDto = {
        id,
        name,
        label,
        details,
        type,
        isRequired,
        categoryId,
    };

    return fieldDto;
}