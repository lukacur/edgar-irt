import { IInputDataExtractor } from "../../../ApplicationModel/Jobs/DataExtractors/IInputDataExtractor.js";
import { GenericRegistry } from "../GenericRegistry.js";


export class InputExtractorRegistry extends GenericRegistry {
    //#region SingletonHandling
    public static readonly instance = new InputExtractorRegistry();
    //#endregion

    private constructor() { super(); }

    public override getItem<TReturnObject extends object = IInputDataExtractor>(
        ieType: string,
        ...args: any[]
    ): TReturnObject {
        return <TReturnObject> super.getItem(ieType, args);
    }
}
