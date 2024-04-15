import { AbstractBatch } from "../../../ApplicationModel/Batch/AbstractBatch.js";
import { DatabaseConnection } from "../../Database/DatabaseConnection.js";
import { TestInstance } from "../../Models/Database/TestInstance/TestInstance.model.js";
import { EdgarItemBatch } from "./EdgarBatch.js";
import { TestInstanceBasedBatch } from "./TestInstanceBasedBatch.js";

export class TestBasedBatch extends EdgarItemBatch<TestInstanceBasedBatch> {
    constructor(
        private readonly databaseConnection: DatabaseConnection,

        public readonly id: number,

        private readonly idTestType: number,
        private readonly idAcademicYear: number,
        private readonly maxScore: number,

        private readonly questionsNo: number,

        private readonly title?: string,
    ) {
        super();
    }

    async loadItems(): Promise<TestInstanceBasedBatch[]> {
        const queryResult =
            await this.databaseConnection.doQuery<TestInstance>(
                `SELECT test_instance.*
                FROM test_instance
                WHERE test_instance.id_test = $1`,
                [this.id]
            );

        if (queryResult === null || queryResult.count === 0) {
            this.items = [];
        } else {
            this.items = queryResult.rows
                .map(ti =>
                    new TestInstanceBasedBatch(
                        this.databaseConnection,

                        ti.id,

                        this.idAcademicYear,
                        this.id,
                        ti.id_student,

                        (typeof(ti.score) === "string") ? parseFloat(ti.score) : (ti.score ?? 0),
                        this.maxScore,
                        (typeof(ti.score_perc) === "string") ? parseFloat(ti.score_perc) : (ti.score_perc ?? 0),
                    )
                );
        }

        return this.items;
    }
    addItemToBatch(item: TestInstanceBasedBatch): Promise<AbstractBatch<TestInstanceBasedBatch>> {
        throw new Error("Method not implemented.");
    }
    getLoadedItems(): TestInstanceBasedBatch[] | null {
        throw new Error("Method not implemented.");
    }
    
    async serializeInto(obj: any): Promise<void> {
        obj.id = this.id;
        obj.type = "test";
        obj.idTestType = this.idTestType;
        obj.idAcademicYear = this.idAcademicYear;
        obj.maxScore = this.maxScore;
        obj.questionsNo = this.questionsNo;

        const testInstancesArr: any[] = [];
        obj.testInstances = testInstancesArr;

        if (this.items === null) {
            await this.loadItems();
        }

        if (this.items === null) {
            throw new Error("Test could not be loaded when serializing a test with id ${this.id}");
        }

        for (const testInstance of this.items) {
            const tstInstObj = {};
            await testInstance.serializeInto(tstInstObj);
            testInstancesArr.push(tstInstObj);
        }
    }

    override async getTestInstancesWithQuestion(questionId: number): Promise<TestInstance[]> {
        return (await Promise.all(
            this.items?.map((ti) => ti.getTestInstancesWithQuestion(questionId)) ?? []
        )).flatMap(e => e);
    }
}
