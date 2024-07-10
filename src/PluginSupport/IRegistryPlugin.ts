import { FactoryDelegate } from "./GenericFactory.js";
import { IRegistrationEntryBase } from "./Registries/RegistrySources/IRegistrySource.js";

export interface IRegistryPlugin extends IRegistrationEntryBase {
    creationFunction: FactoryDelegate;
}
