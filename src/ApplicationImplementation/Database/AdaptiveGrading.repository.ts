import { DatabaseConnection } from "./DatabaseConnection.js";

export class AdaptiveGradingRepository {
    private static instance?: AdaptiveGradingRepository;

    private constructor(
        private readonly connection: DatabaseConnection,
    ) {}

    public static instantiate(dbConnection: DatabaseConnection): void {
        AdaptiveGradingRepository.instance = new AdaptiveGradingRepository(dbConnection);
    }

    public static getInstance(): AdaptiveGradingRepository | null {
        if (!AdaptiveGradingRepository.instance) {
            throw new Error("Singleton not instantiated");
        }

        return AdaptiveGradingRepository.instance;
    }

    public getCourseTests(courseId: number) {
        
    }
}
