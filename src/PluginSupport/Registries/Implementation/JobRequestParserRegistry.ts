import { IJobRunRequestParser } from "../../../ApplicationModel/Jobs/IJobRunRequestParser.js";
import { GenericRegistry } from "../GenericRegistry.js";

export class JobRequestParserRegistry extends GenericRegistry {
    //#region SingletonHandling
    public static readonly instance = new JobRequestParserRegistry();
    //#endregion

    private constructor() { super(); }

    public override getItem<TReturnObject extends object = IJobRunRequestParser<object>>(
        ieType: string,
        ...args: any[]
    ): TReturnObject | null {
        return <TReturnObject> super.getItem(ieType, ...args);
    }
}
