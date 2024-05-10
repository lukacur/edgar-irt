import { LogisticFunctionParams } from "../../../IRT/LogisticFunction/LogisticFunctionTypes.js";

export type CourseBasedCalculation = {
    idQuestion: number;
    scorePercMean: number;
    scorePercStdDev: number;
    scorePercMedian: number;
    totalAchieved: number;
    totalAchievable: number;
    answersCount: number;
    correctPerc: number;
    incorrectPerc: number;
    unansweredPerc: number;
    partialPerc: number;
};

export type TestBasedCalculation = {
    idQuestion: number;
    scorePercMean: number;
    scorePercStdDev: number;
    count: number;
    scorePercMedian: number;
    scoreSum: number;
    partOfTotalSum: number;
    correctPerc: number;
    incorrectPerc: number;
    unansweredPerc: number;
    partialPerc: number;
};

type TestCalculationInfo = {
    idTest: number;
    testData: TestBasedCalculation[];
};

export interface IRCalculationResult {
    courseId: number;
    academicYearIds: number[];
    courseBased: CourseBasedCalculation[];
    testBased: TestCalculationInfo[];
}

export type QuestionClassification = "very_easy" | "easy" | "normal" | "hard" | "very_hard";

export type QuestionIrtParamInfo = {
    idQuestion: number;
    params: LogisticFunctionParams;
    defaultItemOffsetParam: number;

    questionClassification?: QuestionClassification
};

export interface IExtendedRCalculationResult extends IRCalculationResult {
    calculatedIrtParams: QuestionIrtParamInfo[];
}
