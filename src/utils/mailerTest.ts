import * as sendGridTransport from 'nodemailer-sendgrid-transport';
import * as nodemailer from 'nodemailer';

export interface IEmail {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(data: IEmail): Promise<string> {
    const transporter = nodemailer.createTransport(sendGridTransport({
        auth:{
            'api_key':process.env.SENDGRID_API
        }
        }));
    const mailOptions = {
        from: process.env.EMAIL_SENDER,
        to: data.to,
        subject: data.subject,
        html: data.html
    };
    const info = await transporter.sendMail(mailOptions)
    return nodemailer.getTestMessageUrl(info);
}





