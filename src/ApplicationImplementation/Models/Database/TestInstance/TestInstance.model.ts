import { Student } from "../Student.model.js";
import { Test } from "../Test/Test.model.js";

export class TestInstance {
    public id: number = null!;

    public id_test: number = null!;
    public id_test_navigation: Test = null!;

    public id_student: number = null!;
    public id_student_navigation: Student = null!;

    public score: number | null = null;
    public score_perc: number | null = null;
}
