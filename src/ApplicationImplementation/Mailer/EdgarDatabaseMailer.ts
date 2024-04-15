import { SmtpConfiguration } from "../../ApplicationModel/FrameworkConfiguration/IJobAutomatizationFrameworkConfiguration.js";
import { EmailInfo, SmtpCredentials } from "../../ApplicationModel/Models/Email/EmailModels.model.js";
import { IMailer } from "../../Util/MailerProvider.js";
import { DatabaseConnection } from "../Database/DatabaseConnection.js";

type EdgarDatabaseMailerAdditionalParameters = {
    userCreated?: string;
};

export class EdgarDatabaseMailer implements IMailer {
    constructor(
        public readonly databaseConnection: DatabaseConnection,
        public readonly smtpConfig: SmtpConfiguration,
        public readonly workingSchema: string = "public",
    ) {}

    private buildAlwaysObject(): { to: string[], cc: string[], bcc: string[] } {
        return {
            to: this.smtpConfig.always.to ?? [],
            cc: this.smtpConfig.always.cc ?? [],
            bcc: this.smtpConfig.always.bcc ?? [],
        };
    }

    public async sendMail(
        info: EmailInfo,
        useDefaults: boolean,
        additionalParams: object & EdgarDatabaseMailerAdditionalParameters
    ): Promise<boolean> {
        const transaction = await this.databaseConnection.beginTransaction(this.workingSchema);
        const always = this.buildAlwaysObject();
        always.to.push(...(info.header.to ?? this.smtpConfig.defaults.to ?? []));
        always.cc.push(...(info.header.cc ?? this.smtpConfig.defaults.cc ?? []));
        always.bcc.push(...(info.header.bcc ?? this.smtpConfig.defaults.bcc ?? []));
        
        try {
            const count = (await transaction.doQuery(
                `INSERT INTO email_queue(
                    mail_to,
                    mail_cc,
                    mail_bcc,
                    mail_from,
                    mail_subject,
                    mail_text,
                    ts_created,
                    ts_modified,
                    user_modified,
                    user_created
                ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $7, $7)`,
                [
                    /* $1 */ always.to.reduce((acc, el) => acc + ";" + el, ""),
                    /* $2 */ always.cc.reduce((acc, el) => acc + ";" + el, ""),
                    /* $3 */ always.bcc.reduce((acc, el) => acc + ";" + el, ""),
                    /* $4 */ info.header.from ?? this.smtpConfig.defaults.from,
                    /* $5 */ info.header.subject ?? this.smtpConfig.defaults.subject,
                    /* $6 */ info.body.content ?? "",
                    /* $7 */ additionalParams.userCreated ?? "JOB_RUNNING_SYSTEM",
                ]
            ))?.count ?? null;

            if (count !== null && count !== 0) {
                await transaction.commit();
                return true;
            }
        } catch (err) {
            console.log(err);
            await transaction.rollback();
        } finally {
            if (!transaction.isFinished()) {
                await transaction.rollback();
            }
        }

        return false;
    }

    public withUser(credentials: SmtpCredentials): IMailer {
        return this;
    }
}
