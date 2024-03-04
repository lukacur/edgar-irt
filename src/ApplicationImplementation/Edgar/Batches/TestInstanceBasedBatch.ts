import { AbstractBatch } from "../../../ApplicationModel/Batch/AbstractBatch.js";
import { DatabaseConnection } from "../../Database/DatabaseConnection.js";
import { TestInstanceQuestion } from "../../Models/Database/TestInstance/TestInstanceQuestion.model.js";
import { QuestionItem } from "../Items/QuestionItem.js";
import { EdgarItemBatch } from "./EdgarBatch.js";

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
            await this.databaseConnection.doQuery<TestInstanceQuestion & { manual_grade: number | null }>(
                `SELECT test_instance_question.*,
                        test_instance_question_manual_grade.score AS manual_grade
                FROM test_instance
                    JOIN test_instance_question
                        ON test_instance_question.id_test_instance = test_instance.id
                    LEFT JOIN test_instance_question_manual_grade
                        ON test_instance_question_manual_grade.id_test_instance_question = test_instance_question.id`
            );

        if (queryResult === null || queryResult.count === 0) {
            this.items = [];
        } else {
            this.items = queryResult.rows
                .map(tiq =>
                    new QuestionItem(
                        tiq.id,

                        tiq.id_question,

                        this.idStudent,
                        this.id,

                        tiq.is_correct ?? false,
                        tiq.is_incorrect ?? false,
                        tiq.is_unanswered ?? false,
                        tiq.is_partial ?? false,

                        tiq.manual_grade ?? tiq.score ?? 0,
                        (!tiq.score_perc) ? 0 : ((tiq.score ?? 0) / tiq.score_perc),
                        tiq.score_perc ?? 0,
                    )
                );
        }

        return this.items;
    }

    addItemToBatch(item: QuestionItem): Promise<AbstractBatch<QuestionItem>> {
        throw new Error("Method not allowed.");
    }

    getLoadedItems(): QuestionItem[] | null {
        return this.items;
    }

    async serializeInto(obj: any): Promise<void> {
        const questionsObj: { [questionItemId: number]: any } = {}
        const testInstanceInfo = {
            id: this.id,

            idAcademicYear: this.idAcademicYear,
            idTest: this.idTest,
            idStudent: this.idStudent,

            studentScore: this.studentScore,
            testMaxScore: this.testMaxScore,
            solutionPercentage: this.solutionPercentage,

            questions: questionsObj,
        };

        if (this.items === null) {
            await this.loadItems();
        }

        if (this.items === null) {
            throw new Error("Test could not be loaded when serializing a test instance with id ${this.id}");
        }

        for (const questionItem of this.items) {
            const questionObj = {};
            await questionItem.serializeInto(questionObj);
            questionsObj[questionItem.getId()] = questionObj;
        }

        obj.testInstance = testInstanceInfo;
    }
}
