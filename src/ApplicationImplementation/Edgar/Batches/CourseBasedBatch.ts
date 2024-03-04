import { AbstractBatch } from "../../../ApplicationModel/Batch/AbstractBatch.js";
import { DatabaseConnection } from "../../Database/DatabaseConnection.js";
import { Test } from "../../Models/Database/Test/Test.model.js";
import { EdgarItemBatch } from "./EdgarBatch.js";
import { TestBasedBatch } from "./TestBasedBatch.js";

export class CourseBasedBatch extends EdgarItemBatch<TestBasedBatch> {
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

    async loadItems(): Promise<TestBasedBatch[]> {
        const queryResult = await this.databaseConnection.doQuery<Test>(
            `SELECT test.*
            FROM test
            WHERE test.id_course = $1 AND
                    test.id_academic_year = ANY($2)`,
            [this.id, this.academicYearIds]
        );

        if (queryResult === null || queryResult.count === 0) {
            this.items = [];
        } else {
            this.items = queryResult.rows
                .map(tst =>
                    new TestBasedBatch(
                        this.databaseConnection,

                        tst.id,
                        tst.id_test_type,
                        tst.id_academic_year,

                        tst.max_score,
                        tst.questions_no,

                        tst.title,
                    )
                );
        }
        
        return this.items;
    }

    addItemToBatch(item: TestBasedBatch): Promise<AbstractBatch<TestBasedBatch>> {
        throw new Error("Method not allowed.");
    }

    getLoadedItems(): TestBasedBatch[] | null {
        return this.items;
    }

    async serializeInto(obj: any): Promise<void> {
        const testsObj: { [tstId: number]: any } = {}
        const courseInfo = {
            id: this.id,
            academicYearIds: this.academicYearIds,

            tests: testsObj,
        };

        if (this.items === null) {
            await this.loadItems();
        }

        if (this.items === null) {
            throw new Error(`Test could not be loaded when serializing a course with id ${this.id}`);
        }

        for (const test of this.items) {
            const tstObj = {};
            await test.serializeInto(tstObj);
            testsObj[test.id] = tstObj;
        }

        obj.course = courseInfo;
    }
}
