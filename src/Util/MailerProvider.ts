import { EmailInfo, SmtpCredentials } from "../ApplicationModel/Models/Email/EmailModels.model.js";

export interface IMailer {
    sendMail(info: EmailInfo, useDefaults: boolean, additionalParams: object): Promise<boolean>;

    /**
     * Clones the underlying mailer and sets the credentials to the ones passed as the argument.
     * @param credentials the credentials to use with the newly created mailer
     * @returns A new instance of an IMailer implementation
     */
    withUser(credentials: SmtpCredentials): IMailer;
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
