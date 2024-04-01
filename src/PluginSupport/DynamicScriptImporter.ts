import { ImportInfo, InputExtractorConfig, JobStepDescriptor } from "../ApplicationModel/Jobs/IJobConfiguration.js";

export type DynamicScriptDescriptor<TExpectedAbstractType> = {
    type: new(...args: any[]) => TExpectedAbstractType;
    
    setup: () => Promise<void>;
    teardown?: () => Promise<void>;
};

export class DynamicScriptImporter {
    private constructor() {}

    public static async importScript<TExpectedAbstractType>(
        importInfo: ImportInfo
    ): Promise<Omit<DynamicScriptDescriptor<TExpectedAbstractType>, "setup">> {
        const data: DynamicScriptDescriptor<TExpectedAbstractType> = (await import(importInfo.url)).default;
        if (data === undefined || data === null) {
            throw new Error(
                `Unable to import plugin ${importInfo.url}; ` +
                    "Reason: bad export (module does not have a default export object)"
            );
        }

        await data.setup();

        return data;
    }
}
