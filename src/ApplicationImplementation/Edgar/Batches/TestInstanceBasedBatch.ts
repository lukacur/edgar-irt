import { AbstractBatch } from "../../../ApplicationModel/Batch/AbstractBatch.js";
import { DatabaseConnection } from "../../Database/DatabaseConnection.js";
import { TestInstance } from "../../Models/Database/TestInstance/TestInstance.model.js";
import { TestInstanceQuestion } from "../../Models/Database/TestInstance/TestInstanceQuestion.model.js";
import { QuestionItem } from "../Items/QuestionItem.js";
import { EdgarItemBatch } from "./EdgarBatch.js";

type ExtendedTestInstanceQuestion =
    TestInstanceQuestion &
    {
        manual_grade: number | null,
        score_delta: number | null,
        max_score: number,
    }

export class TestInstanceBasedBatch extends EdgarItemBatch<QuestionItem> {
    // testId
    // academicYear
    // QuestionItem[]
    // solvedByStudent
    // score - score achieved by the student
    // maxScore - maximum test score
    // scorePerc - percentage of points gained by the student

    constructor(
        private readonly databaseConnection: DatabaseConnection,

        public readonly id: number,
        private readonly idAcademicYear: number,
        private readonly idTest: number,
        private readonly idStudent: number,

        private readonly studentScore: number,
        private readonly testMaxScore: number,
        private readonly solutionPercentage: number,
    ) {
        super();
    }

    async loadItems(): Promise<QuestionItem[]> {
        const queryResult =
            await this.databaseConnection
                .doQuery<ExtendedTestInstanceQuestion>(
                    `SELECT test_instance_question.*,
                            test_instance_question_manual_grade.score AS manual_grade,
                            test_correction.score_delta,

                            grading_model.correct_score AS max_score
                    FROM test_instance
                        JOIN test_instance_question
                            ON test_instance_question.id_test_instance = test_instance.id
                        JOIN grading_model
                            ON grading_model.id = test_instance_question.id_grading_model
                        LEFT JOIN test_correction
                            ON test_correction.id_test_instance_question = test_instance_question.id
                        LEFT JOIN test_instance_question_manual_grade
                            ON test_instance_question_manual_grade.id_test_instance_question = test_instance_question.id
                    WHERE test_instance_question.id_test_instance = $1`,
                    [this.id]
                );

        if (queryResult === null || queryResult.count === 0) {
            this.items = [];
        } else {
            this.items = queryResult.rows
                .map(tiq => {
                    const manGrade = tiq.manual_grade;
                    const score = (typeof(tiq.score) === "string") ? parseFloat(tiq.score) : (tiq.score ?? 0);
                    const scoreDelta =
                        (typeof(tiq.score_delta) === "string") ? parseFloat(tiq.score_delta) : (tiq.score_delta ?? 0);

                    const scorePerc = (!tiq.score_perc) ?
                        0 :
                        (
                            (typeof(tiq.score_perc) === "string") ? parseFloat(tiq.score_perc) : (tiq.score_perc ?? 0)
                        );
                    const maxScore = (typeof(tiq.max_score) === "string") ? parseFloat(tiq.max_score) : tiq.max_score;

                    const qi = new QuestionItem(
                        tiq.id,

                        tiq.id_question,

                        this.idStudent,
                        this.id,

                        tiq.is_correct ?? false,
                        tiq.is_incorrect ?? false,
                        tiq.is_unanswered ?? false,
                        tiq.is_partial ?? false,

                        ((manGrade !== null) ?
                            (
                                (typeof(manGrade) === "string") ?
                                    parseFloat(manGrade) : manGrade
                            ) :
                            score
                        ) + scoreDelta, // TODO: confirm that this should be deleted and replaced with 'tiq.score'

                        maxScore,

                        scorePerc,
                    );

                    return qi;
                });
        }

        return this.items;
    }

    addItemToBatch(item: QuestionItem): Promise<AbstractBatch<QuestionItem>> {
        throw new Error("Method not allowed.");
    }

    getLoadedItems(): QuestionItem[] | null {
        return this.items;
    }

    override async serializeInto(obj: any): Promise<void> {
        obj.id = this.id;
        obj.type = "test_instance";
        obj.idAcademicYear = this.idAcademicYear;
        obj.idTest = this.idTest;
        obj.idStudent = this.idStudent;
        obj.studentScore = this.studentScore;
        obj.testMaxScore = this.testMaxScore;
        obj.solutionPercentage = this.solutionPercentage;

        const questionsArr: any[] = [];
        obj.testInstanceQuestions = questionsArr;

        if (this.items === null) {
            await this.loadItems();
        }

        if (this.items === null) {
            throw new Error("Test could not be loaded when serializing a test instance with id ${this.id}");
        }

        for (const questionItem of this.items) {
            const questionObj = {};
            await questionItem.serializeInto(questionObj);
            questionsArr.push(questionObj);
        }
    }

    override async getTestInstancesWithQuestion(questionId: number): Promise<TestInstance[]> {
        if ((this.items ?? []).find(it => it.getId() === questionId) === undefined) {
            return [];
        }

        return [{
            id: this.id,
            id_student: this.idStudent,
            id_student_navigation: null!,
            id_test: this.idTest,
            id_test_navigation: null!,
            score: this.testMaxScore,
            score_perc: this.studentScore / ((this.testMaxScore === 0) ? 1 : this.testMaxScore)
        }];
    }
}
