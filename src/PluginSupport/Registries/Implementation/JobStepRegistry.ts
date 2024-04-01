import { randomUUID } from "crypto";
import { IJobStep } from "../../../ApplicationModel/Jobs/IJobStep.js";
import { GenericRegistry } from "../GenericRegistry.js";

export class JobStepRegistry extends GenericRegistry {
    //#region SingletonHandling
    public static readonly instance = new JobStepRegistry();
    //#endregion

    private constructor() { super(); }

    public override getItem<TReturnObject extends object = IJobStep>(
        ieType: string,
        ...args: any[]
    ): TReturnObject {
        const step = <TReturnObject & { stepRunId: string }>super.getItem(ieType, ...args);
        step.stepRunId = randomUUID();

        return step;
    }
}
