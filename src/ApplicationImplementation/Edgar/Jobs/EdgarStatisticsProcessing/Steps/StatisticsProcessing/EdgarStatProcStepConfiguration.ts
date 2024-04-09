export class EdgarStatProcStepConfiguration {
    constructor(
        public readonly calculationScriptAbsPath: string,
        public readonly inputJSONInfoAbsPath: string,

        public readonly outputFile: string | null,
    ) {}
}
