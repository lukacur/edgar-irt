import { DatabaseConnection } from "./ApplicationModel/Database/DatabaseConnection.js";
import { IJobConfiguration } from "./ApplicationModel/Jobs/IJobConfiguration.js";
import { AbstractTypedWorkResultPersistor } from "./ApplicationModel/Jobs/WorkResultPersistors/AbstractTypedWorkResultPersistor.js";
import { DatabaseConnectionRegistry } from "./PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js"
import { PersistorRegistry } from "./PluginSupport/Registries/Implementation/PersistorRegistry.js";

let conn: DatabaseConnection | null = null;
async function setup() {
    const dbConn = conn = await DatabaseConnection.fromConfigFile("./database-config.json");

    DatabaseConnectionRegistry.instance.registerItem(
        "example_connection",
        () => dbConn,
    );

    PersistorRegistry.instance.registerItem(
        "example_persistor",
        () => new ExamplePersistorPluginScript(),
    );
}

async function teardown() {
    await conn?.close();
}

class ExamplePersistorPluginScript extends AbstractTypedWorkResultPersistor<object, IJobConfiguration> {
    protected async persistResultTyped(jobResult: object | null, jobConfig: IJobConfiguration): Promise<boolean> {
        console.log(jobResult);

        return true;
    }
}

export default { type: ExamplePersistorPluginScript, setup, teardown }
