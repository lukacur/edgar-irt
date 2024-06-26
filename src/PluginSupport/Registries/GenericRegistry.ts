import { FactoryDelegate, GenericFactory } from "../GenericFactory.js";

export abstract class GenericRegistry {
    protected readonly registeredInputExtractors: Map<string, GenericFactory | FactoryDelegate> = new Map();

    public registerItem(ieType: string, typeFactory: GenericFactory | FactoryDelegate): void {
        this.registeredInputExtractors.set(ieType, typeFactory);
    }

    public getItem<TReturnObject extends object>(
        ieType: string,
        ...args: any[]
    ): TReturnObject | null {
        if (!this.registeredInputExtractors.has(ieType)) {
            return null;
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

    public getRegisteredItems(): [string, GenericFactory | FactoryDelegate][] {
        const arr: [string, GenericFactory | FactoryDelegate][] = [];

        for (const entry of this.registeredInputExtractors.entries()) {
            arr.push(entry);
        }

        return arr;
    }
}
