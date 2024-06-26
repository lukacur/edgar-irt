import { IWorkResultPersistor } from "../../../ApplicationModel/Jobs/WorkResultPersistors/IWorkResultPersistor.js";
import { GenericRegistry } from "../GenericRegistry.js";

export class PersistorRegistry extends GenericRegistry {
    //#region SingletonHandling
    public static readonly instance = new PersistorRegistry();
    //#endregion

    private constructor() { super(); }

    public override getItem<TReturnObject extends object = IWorkResultPersistor>(
        ieType: string,
        ...args: any[]
    ): TReturnObject | null {
        return <TReturnObject> super.getItem(ieType, ...args);
    }
}
