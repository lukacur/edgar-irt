import { AvailableRegistry } from "../../../ApplicationModel/Decorators/Registration.decorator.js";

export interface IRegistrationEntryBase {
    readonly registry: AvailableRegistry;
    readonly namespace: string;
    readonly name: string;
}

export interface IRegistrySource {
    loadIntoRegistries(): Promise<boolean>;
}
