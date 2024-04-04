import { DatabaseConnection } from "../../ApplicationImplementation/Database/DatabaseConnection.js";
import { DatabaseConnectionRegistry } from "../../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { RegistryDefaultConstants } from "../../PluginSupport/RegistryDefault.constants.js";
import { MailerProvider } from "../../Util/MailerProvider.js";
import { IJobAutomatizationFrameworkConfiguration } from "./IJobAutomatizationFrameworkConfiguration.js";

export class FrameworkConfigurationProvider {
    public static readonly instance = new FrameworkConfigurationProvider();

    private constructor() {}

    private configuration: IJobAutomatizationFrameworkConfiguration | null = null;

    public useConfiguration(config: IJobAutomatizationFrameworkConfiguration) {
        this.configuration = config;
    }

    public hasConfiguration(): boolean {
        return this.configuration !== null;
    }

    public registerDefaultMailer() {
        MailerProvider.instance.registerMailer({
            async sendMail(info) {
                return true;
            },

            withUser(credentials) {
                return this;
            },
        });
    }

    public registerDefaultConnectionProvider() {
        DatabaseConnectionRegistry.instance.registerItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
            () => {
                if (this.configuration === null) {
                    throw new Error(`Configuration of the ${FrameworkConfigurationProvider.name} musn't be null`);
                }

                const dbConnect = this.configuration.databaseConnectivity;

                if ("connectionString" in dbConnect) {
                    return DatabaseConnection.fromConnectionString(dbConnect.connectionString);
                } else if ("connectionConfiguration" in dbConnect) {
                    return DatabaseConnection.fromConfig(dbConnect.connectionConfiguration);
                }
                
                throw new Error(`Invalid configuration passed to ${FrameworkConfigurationProvider.name} singleton`);
            }
        );
    }

//#region Database connectivity configuration
    public getJobSchemaName(): string {
        if (this.configuration === null) {
            throw new Error(`Configuration of the ${FrameworkConfigurationProvider.name} musn't be null`);
        }

        return this.configuration.databaseConnectivity.jobSchemaName;
    }

    public getDefaultConnection(): DatabaseConnection {
        return DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );
    }
//#endregion

//#region SMTP configuration
    public getMailDefaults() {
        if (this.configuration === null) {
            throw new Error(`Configuration of the ${FrameworkConfigurationProvider.name} musn't be null`);
        }

        return this.configuration.smtpConfiguration.defaults;
    }

    public getSmtpConfiguration() {
        if (this.configuration === null) {
            throw new Error(`Configuration of the ${FrameworkConfigurationProvider.name} musn't be null`);
        }

        return this.configuration.smtpConfiguration;
    }
//#endregion
}
