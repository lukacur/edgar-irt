export class EdgarStatProcDataExtractorConfiguration {
    constructor(
        public readonly databaseConnection: string,
        public readonly idCourse: number,
        public readonly idStartAcademicYear: number,
        public readonly numberOfIncludedPreviousYears: number,
    ) {}
}
