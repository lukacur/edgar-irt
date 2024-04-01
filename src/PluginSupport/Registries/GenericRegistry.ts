import { FactoryDelegate, GenericFactory } from "../GenericFactory.js";

export abstract class GenericRegistry {
    protected readonly registeredInputExtractors: Map<string, GenericFactory | FactoryDelegate> = new Map();

    public registerItem(ieType: string, typeFactory: GenericFactory | FactoryDelegate): void {
        this.registeredInputExtractors.set(ieType, typeFactory);
    }

    public getItem<TReturnObject extends object>(
        ieType: string,
        ...args: any[]
    ): TReturnObject {
        if (!this.registeredInputExtractors.has(ieType)) {
            throw new Error(`Requested item was not registered: no item present under key ${ieType}`);
        }

        const regIe = this.registeredInputExtractors.get(ieType)!;

        if ((!("create" in regIe) || typeof(regIe.create) !== "function") && typeof(regIe) !== "function") {
            throw new Error(
                "The item previously registered is not of required type (GenericFactory or FactoryDelegate)"
            );
        }

        return <TReturnObject>(
            ("create" in regIe) ?
                regIe.create(...args) :
                regIe(...args)
        );
    }
}
