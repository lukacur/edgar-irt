import { IDatabaseConfig } from "../../ApplicationImplementation/Models/Config/DatabaseConfig.model.js";

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

type SmtpConfiguration = {
    defaults: {
        from: string;
        to: string;
        subject: string;
    };

    host: string;
    port: number;

    useTls: boolean;

    credentials:
        {
            username: string;
            password: string;
        } |
        {
            applicationToken: string;
        } |
        {
            certificateBase64: string;
        };

    timeoutMs: number;
};

export interface IJobAutomatizationFrameworkConfiguration {
    databaseConnectivity: DatabaseConnectivity;
    smtpConfiguration: SmtpConfiguration;
}
