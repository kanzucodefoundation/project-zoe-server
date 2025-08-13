export enum ReportType {
  TABLE = "table",
  PIECHART = "piechart",
  BARGRAPH = "bargraph",
  LINECHART = "linechart",
}

export enum ReportFieldType {
  Text = "text",
  TextArea = "textarea",
  Number = "number",
  Date = "date",
  Boolean = "boolean",
  Checkbox = "checkbox",
  Radio = "radio",
}

export enum ReportSubmissionFrequency {
  Daily = "daily",
  Weekly = "weekly",
  Monthly = "monthly",
  Custom = "custom",
}

export enum ReportStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
}
