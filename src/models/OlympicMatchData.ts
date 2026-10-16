export interface EventUnitEntry {
    eue_code?: string;
    code?: string;
    eue_value?: string | null;
    value?: string | null;
}

export interface ExtendedInfo {
    ei_type?: string;
    ei_value?: string | null;
}

export interface MatchPeriod {
    p_code?: string;
    home?: { score?: number | string | null } | null;
    away?: { score?: number | string | null } | null;
}

export interface OlympicParticipant {
    description?: string | null;
    name?: string | null;
    organisation?: { code?: string | null; description?: string | null } | null;
}

export interface OlympicAthlete {
    participantCode?: string;
    bib?: string | null;
    athlete?: { givenName?: string | null; familyName?: string | null } | null;
    eventUnitEntries?: EventUnitEntry[];
}

export interface OlympicCoach {
    function?: { functionCode?: string } | null;
    coach?: { name?: string | null } | null;
}

export interface OlympicTeam {
    participant?: OlympicParticipant | null;
    teamAthletes?: OlympicAthlete[] | null;
    teamCoaches?: OlympicCoach[] | null;
    eventUnitEntries?: EventUnitEntry[];
}

export interface PlayByPlayAction {
    pbpa_Result?: string;
    pbpa_Action?: string;
    pbpa_When?: string | null;
    competitors?: {
        athletes?: { pbpat_role?: string; pbpat_code?: string }[];
    }[];
}

export interface PlayByPlayPeriod {
    actions?: PlayByPlayAction[] | null;
}

export interface OlympicLocation {
    description?: string | null;
    longDescription?: string | null;
}

export interface OlympicSchedule {
    startDate?: string | null;
    order?: number | string | null;
    eventUnit?: { description?: string | null; resultRSC?: string | null } | null;
    result?: { periods?: MatchPeriod[] } | null;
    start?: {
        participant?: OlympicParticipant | null;
        startParticipant?: OlympicParticipant | null;
    }[] | null;
    location?: OlympicLocation | null;
}

export interface ScheduleData {
    schedules?: OlympicSchedule[] | null;
}

export interface OlympicMatchResult {
    items?: OlympicTeam[];
    periods?: MatchPeriod[];
    extendedInfos?: ExtendedInfo[];
    eventUnit?: { shortDescription?: string | null } | null;
    schedule?: {
        startDate?: string | null;
        location?: OlympicLocation | null;
        venue?: OlympicLocation | null;
    } | null;
    playByPlay?: PlayByPlayPeriod[] | null;
}

export interface OlympicMatchData {
    result?: OlympicMatchResult | null;
    results?: OlympicMatchResult | null;
    location?: OlympicLocation | null;
    venue?: OlympicLocation | null;
    startDate?: string | null;
}
