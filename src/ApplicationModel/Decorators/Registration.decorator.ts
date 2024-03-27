import { FactoryDelegate, GenericFactory } from "../../PluginSupport/GenericFactory.js";
import { DatabaseConnectionRegistry } from "../../PluginSupport/Registries/Implementation/DatabaseConnectionRegistry.js";
import { InputExtractorRegistry } from "../../PluginSupport/Registries/Implementation/InputExtractorRegistry.js";
import { JobStepRegistry } from "../../PluginSupport/Registries/Implementation/JobStepRegistry.js";
import { JobWorkerRegistry } from "../../PluginSupport/Registries/Implementation/JobWorkerRegistry.js";
import { PersistorRegistry } from "../../PluginSupport/Registries/Implementation/PersistorRegistry.js";

export type AvailableRegistry =
    "InputDataExtractor" |
    "JobWorker" |
    "JobStep" |
    "Persistor" |
    "DatabaseConnection";

export function RegisterDelegateToRegistry(
    registry: AvailableRegistry,
    key: string
) {
    return function <TDecoratedItem extends FactoryDelegate>(
        target: Object,
        propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<TDecoratedItem>
    ) {
        if (!descriptor.value) {
            throw new Error(
                `Unable to register to registry with MethodDecorator:
                  decorator: ${RegisterDelegateToRegistry.name}
                  target: ${target.constructor.name};
                  method: ${propertyKey.toString()}`
            );
        }
        switch (registry) {
            case "InputDataExtractor": {
                InputExtractorRegistry.instance.registerItem(key, descriptor.value);
                break;
            }

            case "JobWorker": {
                JobWorkerRegistry.instance.registerItem(key, descriptor.value);
                break;
            }

            case "Persistor": {
                PersistorRegistry.instance.registerItem(key, descriptor.value);
                break;
            }

            case "JobStep": {
                JobStepRegistry.instance.registerItem(key, descriptor.value);
                break;
            }

            case "DatabaseConnection": {
                DatabaseConnectionRegistry.instance.registerItem(key, descriptor.value);
                break;
            }

            default: throw new Error("Not yet implemented");
        }
    };
}

export function RegisterFactoryToRegistry(
    registry: AvailableRegistry,
    key: string
) {
    return function <TCtor extends new() => GenericFactory>(
        target: InstanceType<TCtor> extends GenericFactory ? TCtor : never
    ) {
        const factoryInst = new target();
        if (!("create" in factoryInst) || typeof(factoryInst.create) !== "function") {
            throw new Error("Decorator is applied to an unsupported class type");
        }

        switch (registry) {
            case "InputDataExtractor": {
                InputExtractorRegistry.instance.registerItem(key, factoryInst);
                break;
            }

            case "JobWorker": {
                JobWorkerRegistry.instance.registerItem(key, factoryInst);
                break;
            }

            case "Persistor": {
                PersistorRegistry.instance.registerItem(key, factoryInst);
                break;
            }
        }

        return target;
    }
}
