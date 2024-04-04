import { EmailInfo, SmtpCredentials } from "../ApplicationModel/Models/Email/EmailModels.model.js";

export interface IMailer {
    sendMail(info: EmailInfo): Promise<boolean>;
}

export class MailerProvider {
    public static readonly instance = new MailerProvider();

    private constructor() {}

    private mailer: IMailer | null = null;

    public registerMailer(mailer: IMailer): void {
        if (this.mailer !== null) {
            throw new Error("Mailer was already registered");
        }

        this.mailer = mailer;
    }

    public hasMailer(): boolean {
        return this.mailer !== null;
    }

    public getMailer(): IMailer {
        if (this.mailer === null) {
            throw new Error("No mailer was registered");
        }

        return this.mailer;
    }
}
