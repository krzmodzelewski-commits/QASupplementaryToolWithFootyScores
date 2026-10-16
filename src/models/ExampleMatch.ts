type ExampleMatch = {
    competition: {
        round: string | null;
        name: string | null;
        season: string | null;
    };
    venue: {
        name: string | null;
        city: string | null;
    };
    kickoff: string | null;
    status: string | null;
    teams: {
        home: string | null;
        away: string | null;
    };
    score: {
        home: number | null;
        away: number | null;
        halfTime: {
            home: number | null;
            away: number | null;
        };
    };
    lineups: {
        home: TeamLineup;
        away: TeamLineup;
    };
    scorers: Scorer[];
};