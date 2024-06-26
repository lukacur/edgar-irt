import { JobWorkerConfig } from "../../../ApplicationModel/Jobs/IJobConfiguration.js";
import { IJobWorker } from "../../../ApplicationModel/Jobs/Workers/IJobWorker.js";
import { GenericRegistry } from "../GenericRegistry.js";

export class JobWorkerRegistry extends GenericRegistry {
    //#region SingletonHandling
    public static readonly instance = new JobWorkerRegistry();
    //#endregion

    private constructor() { super(); }

    public override getItem<TReturnObject extends object = IJobWorker>(
        ieType: string,
        workerConfig: JobWorkerConfig,
        ...args: any[]
    ): TReturnObject | null {
        return <TReturnObject>super.getItem(ieType, workerConfig, ...args);
    }
}
