import { IsDefined, IsObject } from "class-validator";
import * as Joi from "joi";

export class ReportSubmissionDto {
  reportId: number;

  @IsDefined()
  @IsObject()
  data: Record<string, any>;
}

export class ReportSubmissionDtoV2 {
  date: string;
  smallGroupName: string;
  smallGroupId: number;
  mcHostHome: string;
  smallGroupNumberOfMembers: string;
  mcHuddleCount: string;
  smallGroupAttendanceCount: string;
  mcAttendeeNames: string;
  mcGeneralFeedback: string;
  mcWordHighlights: string;
  mcTestimonies: string;
  mcFrontierStory: string;
  mcPrayerRequest: string;
}

const nestedReportSchema = Joi.object().keys({
  date: Joi.string().required(),
  smallGroupName: Joi.string()
    .min(5)
    .required()
    .error(new Error("Provide smallGroupName")),
  smallGroupId: Joi.number().required(),
  mcHostHome: Joi.string().required(),
  smallGroupNumberOfMembers: Joi.string().required(),
  mcHuddleCount: Joi.string().required(),
  smallGroupAttendanceCount: Joi.string().required(),
  mcAttendeeNames: Joi.string().required(),
  mcGeneralFeedback: Joi.string().required(),
  mcWordHighlights: Joi.string().required(),
  mcTestimonies: Joi.string().required(),
  mcPrayerRequest: Joi.string().required(),
  mcFrontierStory: Joi.string(),
});

export const reportSubmissionSchema = Joi.object({
  reportId: Joi.string().required(),
  data: nestedReportSchema,
}).options({
  abortEarly: false,
});
