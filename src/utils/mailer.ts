import nodemailer from "nodemailer";

const mailConfig = {};

export interface Email {
    to: string;
    subject: string;
    text: string;
}

export async function sendEmail(data: Email) {
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
