import { AcademicYear } from "./AcademicYear.model.js";
import { Course } from "./Course.model.js";
import { Student } from "./Student.model.js";

export class StudentCourse {
    public id: number = null!;

    public id_academic_year: number = null!;
    public id_academic_year_navigation: AcademicYear = null!;

    public id_course: number = null!;
    public id_course_navigation: Course = null!;
    
    public id_student: number = null!;
    public id_student_navigation: Student = null!;
}
