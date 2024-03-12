type CourseBasedCalculation = {
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

type TestBasedQuestionEntry = {
    idQuestion: number;
    mean: number;
    stdDev: number;
    count: number;
    median: number;
    sum: number;
    partOfTotalSum: number;
};

type TestBasedCalculation = {
    idTest: number;
    testData: TestBasedQuestionEntry[];
};

export interface IRCalculationResult {
    courseId: number;
    academicYearIds: number[];
    courseBased: CourseBasedCalculation[];
    testBased: TestBasedCalculation[];
};
