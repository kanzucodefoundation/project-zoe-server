import { Logger } from "@nestjs/common";

export interface IEmail {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(data: IEmail): Promise<string> {
  let postmark = require("postmark");
  const serverToken = process.env.POSTMARK_SERVER_TOKEN;
  let client = new postmark.ServerClient(serverToken);

  const emailResponse = await client.sendEmail({
    From: process.env.EMAIL_SENDER,
    To: data.to,
    Subject: data.subject,
    HtmlBody: data.html,
    MessageStream: process.env.POSTMARK_MESSAGE_STREAM,
  });

  Logger.log(
    `Sending email. Response to: ${emailResponse.To}. Message: ${emailResponse.Message}`,
  );
  return emailResponse;
}
