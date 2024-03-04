import { AbstractBatch } from "../../../ApplicationModel/Batch/AbstractBatch.js";
import { DatabaseConnection } from "../../Database/DatabaseConnection.js";
import { TestInstance } from "../../Models/Database/TestInstance/TestInstance.model.js";
import { TestInstanceBasedBatch } from "./TestInstanceBasedBatch.js";

export class TestBasedBatch extends AbstractBatch<TestInstanceBasedBatch> {
    constructor(
        private readonly databaseConnection: DatabaseConnection,

        private readonly id: number,

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
            await this.databaseConnection.doQuery<TestInstance & { manual_grade: number | null }>(
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

                        ti.score ?? 0,
                        this.maxScore,
                        ti.score_perc ?? 0,
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
    
}
