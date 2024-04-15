import { IDatabaseConfig } from "../../ApplicationImplementation/Models/Config/DatabaseConfig.model.js";
import { EmailHeader, SmtpCredentials } from "../Models/Email/EmailModels.model.js";

type DatabaseConnectivity =
{
    jobSchemaName: string;
} &
(
    {
        connectionString: string;
    } |
    {
        connectionConfiguration: IDatabaseConfig;
    }
);

export type SmtpConfiguration = {
    defaults: EmailHeader;

    always: {
        to?: string[];
        cc?: string[];
        bcc?: string[];
    };

    host: string;
    port: number;

    useTls: boolean;

    credentials: SmtpCredentials;

    timeoutMs: number;
};

export type MailerConfiguration =
{
    mailerType: "edgar-db-mailer";
    databaseConnection: string;
    workingSchema: string;
} |
{
    mailerType: "nodemailer";
};

export interface IJobAutomatizationFrameworkConfiguration {
    databaseConnectivity: DatabaseConnectivity;
    smtpConfiguration: SmtpConfiguration;
    mailerConfiguration: MailerConfiguration;
}
