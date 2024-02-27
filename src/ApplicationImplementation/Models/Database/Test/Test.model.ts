import { AcademicYear } from "../AcademicYear.model.js";
import { Course } from "../Course.model.js";
import { TestType } from "./TestType.model.js";

export class Test {
    public id: number = null!;
    public title: string = null!;

    public id_course: number = null!;
    public id_course_navigation: Course = null!;

    public id_academic_year: number = null!;
    public id_academic_year_navigation: AcademicYear = null!;

    public id_test_type: number = null!;
    public id_test_type_navigation: TestType = null!;

    public max_score: number = null!;

    public pass_percentage: number = null!;
}
