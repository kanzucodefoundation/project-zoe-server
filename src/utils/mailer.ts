import { Logger } from "@nestjs/common";
import { MessageSendingResponse } from "postmark/dist/client/models";
import * as postmark from "postmark";

export interface IEmail {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(data: IEmail): Promise<string> {
  const serverToken = process.env.POSTMARK_SERVER_TOKEN;
  let client = new postmark.ServerClient(serverToken);
  if (process.env.NODE_ENV === "development") {
    // We don't send an actual email in dev mode
    Logger.log(
      `Sending email to: ${data.to}#Subject:${data.subject}#Message: ${data.html}`,
    );
    return;
  }
  const emailResponse: MessageSendingResponse = await client.sendEmail({
    From: process.env.EMAIL_SENDER,
    To: data.to,
    Subject: data.subject,
    HtmlBody: data.html,
    MessageStream: process.env.POSTMARK_MESSAGE_STREAM,
  });

  Logger.log(
    `Sending email. Response to: ${emailResponse.To}. Message: ${emailResponse.Message}`,
  );
  return emailResponse.MessageID;
}
