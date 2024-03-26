import { IWorkResultPersistor } from "../../ApplicationModel/Jobs/WorkResultPersistors/IWorkResultPersistor.js";
import { FactoryDelegate, GenericFactory } from "../GenericFactory.js";

export abstract class GenericRegistry {
    protected readonly registeredInputExtractors: Map<string, GenericFactory | FactoryDelegate> = new Map();

    public registerItem(ieType: string, typeFactory: GenericFactory | FactoryDelegate): void {
        this.registeredInputExtractors.set(ieType, typeFactory);
    }

    public getItem<TReturnObject extends object = IWorkResultPersistor>(
        ieType: string,
        ...args: any[]
    ): TReturnObject {
        if (!this.registeredInputExtractors.has(ieType)) {
            throw new Error("Requested InputExtractor was not registered");
        }

        const regIe = this.registeredInputExtractors.get(ieType)!;

        return <TReturnObject>(
            (regIe instanceof GenericFactory) ?
                regIe.create(args) :
                regIe(args)
        );
    }
}
