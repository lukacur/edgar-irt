import { AdaptiveGradingDaemon } from "./AdaptiveGradingDaemon/AdaptiveGradingDaemon.js";
import { DelayablePromise } from "./Util/DelayablePromise.js";
import { readFile } from 'fs/promises'
import { DatabaseConnectionRegistry } from "./PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { RegistryDefaultConstants } from "./PluginSupport/RegistryDefault.constants.js";
import { FrameworkConfigurationProvider } from "./ApplicationModel/FrameworkConfiguration/FrameworkConfigurationProvider.js";
import { PluginsRegistrySource } from "./PluginSupport/Registries/RegistrySources/PluginsRegistrySource.js";
import { RegistryUtil } from "./Util/RegistryUtil.js";
import { SignalsUtil } from "./Util/SignalsUtil.js";

export class EdgarIRTEntrypoint {
    public static async main(args: string[]): Promise<void> {
        FrameworkConfigurationProvider.instance.useConfiguration({
            databaseConnectivity: {
                connectionConfiguration: JSON.parse(
                    await readFile("./database-config.json", { encoding: "utf-8" })
                ),
                jobSchemaName: "job_tracking_schema",
            },
            smtpConfiguration: {
                always: {},
                credentials: { type: "cert", certificateBase64: "" },
                defaults: {from: "foo", subject: "Foo", to: []},
                host: "",
                port: 0,
                timeoutMs: 10000,
                useTls: true,
            },
            mailerConfiguration: {
                mailerType: "edgar-db-mailer",
                databaseConnection: RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY,
                workingSchema: "public",
            }
        });

        await FrameworkConfigurationProvider.instance.registerDefaultConnectionProvider();
        await FrameworkConfigurationProvider.instance.registerConfiguredMailer();

        const conn = DatabaseConnectionRegistry.instance.getItem(
            RegistryDefaultConstants.DEFAULT_DATABASE_CONNECTION_KEY
        );
        if (conn === null) {
            throw new Error("Unable to get registered connection");
        }

        await new PluginsRegistrySource().loadIntoRegistries();

        console.log("Available registry entries: ", RegistryUtil.getAllRegistryEntries());

        console.log("Passed arguments:");
        console.log(args);
        console.log("-----------------");

        const daemon = new AdaptiveGradingDaemon(
            "./adapGrading.config.json",
            (dmn, reason) => console.log(`This is a forced daemon shutdown: ${reason ?? ""}`)
        );

        let terminated = false;

        daemon.start();

        const prm = new DelayablePromise<void>();

        process.on("SIGTERM", (sig) => {
            SignalsUtil.instance.emit(sig);
            terminated = true;
            console.log("Force shutdown requested (user sent SIGTERM)");
            daemon.forceShutdown("Terminated by user")
                .then(() => {
                    process.exit(0);
                });
        });

        process.on("SIGINT", async (sig) => {
            SignalsUtil.instance.emit(sig);
            terminated = true;
            let exitCode = 0;

            try {
                await daemon.shutdown();
                console.log("Adaptive grading daemon shutdown successful (SIGINT)");
            } catch (err) {
                console.log("Unable to shutdown adaptive grading daemon. Reason:");
                console.log(err);
                exitCode = 1384;
            } finally {
                process.exit(exitCode);
            }
        });

        await prm.getWrappedPromise();

        await conn.close();
    }
}
