export type CourseBasedCalculation = {
    idQuestion: number;
    scoreMean: number;
    scoreStdDev: number;
    scoreMedian: number;
    totalAchieved: number;
    totalAchievable: number;
    answersCount: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    partial: number;
};

export type TestBasedCalculation = {
    idQuestion: number;
    mean: number;
    stdDev: number;
    count: number;
    median: number;
    sum: number;
    partOfTotalSum: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    partial: number;
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
};
