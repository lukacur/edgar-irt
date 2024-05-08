export class EdgarJudge0StatProcStepConfiguration {
    constructor(
        public readonly judge0ServerAddress: string,

        public readonly languageId: number,
        public readonly stdin: string,
        
        public readonly judge0Authentication?: { header: string, value: string },
        public readonly judge0Authorization?: { header: string, value: string },
    ) {}
}
