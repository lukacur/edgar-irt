import { AvailableRegistry } from "../ApplicationModel/Decorators/Registration.decorator.js";
import { GenericRegistry } from "../PluginSupport/Registries/GenericRegistry.js";
import * as fs from 'fs/promises';
import { DatabaseConnectionRegistry } from "../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { InputExtractorRegistry } from "../PluginSupport/Registries/Implementation/InputExtractorRegistry.js";
import { JobStepRegistry } from "../PluginSupport/Registries/Implementation/JobStepRegistry.js";
import { JobWorkerRegistry } from "../PluginSupport/Registries/Implementation/JobWorkerRegistry.js";
import { PersistorRegistry } from "../PluginSupport/Registries/Implementation/PersistorRegistry.js";
import { JobRequestParserRegistry } from "../PluginSupport/Registries/Implementation/JobRequestParserRegistry.js";

export class RegistryUtil {
    private static tmpDir: string | null = null;

    private constructor() {}

    public static determineRegistry(registryName: AvailableRegistry): GenericRegistry | null {
        switch (registryName) {
            case "InputDataExtractor": {
                return InputExtractorRegistry.instance;
            }

            case "JobWorker": {
                return JobWorkerRegistry.instance;
            }

            case "JobStep": {
                return JobStepRegistry.instance;
            }

            case "Persistor": {
                return PersistorRegistry.instance;
            }

            case "DatabaseConnection": {
                return DatabaseConnectionRegistry.instance;
            }

            case "JobRequestParser": {
                return JobRequestParserRegistry.instance;
            }
        }

        return null;
    }

    public static async provideTempDir(): Promise<string | null> {
        if (RegistryUtil.tmpDir !== null) {
            return RegistryUtil.tmpDir;
        }

        try {
            RegistryUtil.tmpDir = await fs.mkdtemp("registry-plugins-tmp");
            return RegistryUtil.tmpDir;
        } catch (err) {
            console.log(err);
            return null;
        }
    }

    private static readonly registries: GenericRegistry[] = [
        DatabaseConnectionRegistry.instance,
        InputExtractorRegistry.instance,
        JobRequestParserRegistry.instance,
        JobStepRegistry.instance,
        JobWorkerRegistry.instance,
        PersistorRegistry.instance,
    ];

    public static getAllRegistryEntries(): string[] {
        return RegistryUtil.registries.flatMap(
            reg => reg.getRegisteredItems().map(entr => entr[0])
        );
    }
}
