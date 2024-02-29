import { AbstractBatch } from "../../../ApplicationModel/Batch/AbstractBatch.js";
import { DatabaseConnection } from "../../Database/DatabaseConnection.js";
import { TestInstance } from "../../Models/Database/TestInstance/TestInstance.model.js";
import { TestInstanceBasedBatch } from "./TestInstanceBasedBatch.js";

export class CourseBasedBatch extends AbstractBatch<TestInstanceBasedBatch> {
    // TestInstanceBasedBatch[]

    constructor(
        private readonly databaseConnection: DatabaseConnection,

        private readonly id: number,
        private readonly academicYearIds: number[],

        private readonly courseName?: string,
        private readonly courseAcronym?: string,
    ) {
        super();
    }

    async loadItems(): Promise<TestInstanceBasedBatch[]> {
        const queryResult = await this.databaseConnection.doQuery<TestInstance & { academicYear: number }>(
            `SELECT test_instance.*,
                    test.academic_year
            FROM course
                JOIN test
                    ON test.id_course = course.id
                JOIN test_instance
                    ON test_instance.id_test = test.id
                JOIN academic_year
                    ON academic_year.id = test.id_academic_year
            WHERE course.id = $1 AND
                    academic_year.id = ANY($2)`,
            [this.id, this.academicYearIds]
        );

        if (queryResult === null || queryResult.count === 0) {
            this.items = [];
        } else {
            this.items = queryResult.rows
                .map(testInstance =>
                    new TestInstanceBasedBatch(
                        this.databaseConnection,
                        testInstance.id,
                        testInstance.academicYear,
                        testInstance.id_test,
                        testInstance.id_student,

                        testInstance.score ?? 0,
                        (!testInstance.score_perc) ? 0 : ((testInstance.score ?? 0) / testInstance.score_perc),
                        testInstance.score_perc ?? 0,
                    )
                );
        }
        
        return this.items;
    }

    addItemToBatch(item: TestInstanceBasedBatch): Promise<AbstractBatch<TestInstanceBasedBatch>> {
        throw new Error("Method not allowed.");
    }

    getLoadedItems(): TestInstanceBasedBatch[] | null {
        return this.items;
    }
}
