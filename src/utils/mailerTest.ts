const nodemailer = require("nodemailer");

export interface IEmail {
    to: string
    subject: string
    html: string
}

export async function sendEmail(data: IEmail): Promise<string> {
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass
        }
    });
    const mailOptions = {
        from: testAccount.user,
        to: data.to,
        subject: data.subject,
        html: data.html
    };
    const info = await transporter.sendMail(mailOptions)
    return nodemailer.getTestMessageUrl(info);
}






