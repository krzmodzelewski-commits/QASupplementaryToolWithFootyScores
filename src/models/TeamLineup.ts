type TeamLineup = {
    team: string | null;
    formation: string | null;
    coach: string | null;
    coaches: string[];
    startingXI: Player[];
    bench: Player[];
};