import nodemailer from "nodemailer";

const mailConfig = {};

export interface IEmail {
    to: string;
    subject: string;
    text: string;
}

export async function sendEmail(data: IEmail) {
    const transporter = nodemailer.createTransport({
        service: "SendGrid",
        auth: {
            user: process.env.SENDGRID_USER,
            pass: process.env.SENDGRID_PASSWORD
        }
    });
    const mailOptions = {
        to: data.to,
        from: "ekastimo@gmail.com",
        subject: data.subject,
        text: data.text
    };
    await transporter.sendMail(mailOptions);
}
