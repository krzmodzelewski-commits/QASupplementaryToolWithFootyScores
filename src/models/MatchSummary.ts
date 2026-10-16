export interface MatchSummary {
    timeAndOrder: {
        startDate?: string | null;
        order?: number | string | null;
    };
    event: {
        description?: string | null;
        resultRSC?: string | null;
        participants: {
            code: string | null;
            description: string | null;
        }[];
    };
    result: {
        homeScore: number | string | null;
        awayScore: number | string | null;
    };
    location: {
        longDescription?: string | null;
    };
}
