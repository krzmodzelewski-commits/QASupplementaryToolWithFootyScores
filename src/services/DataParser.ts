import type {CompetitionData} from '../models/CompetitionData';
import type {MatchSummary} from '../models/MatchSummary';

import {URLS} from '../constants/OlympicResultsUrlsConstant';
import { FOOTBALL_ACTION_TYPES } from '../constants/FootballConstants';

export class DataParser {
    /** Extracts non-empty competition dates from schedule data. */
    extractCompetitionDates(data?: CompetitionData | null): string[] {
        return (data?.competition_schedule || [])
            .map(item => item.date)
            .filter((date): date is string => Boolean(date));
    }


    /** Builds the match schedule endpoint URL for the given day. */
    buildMatchSummaryUrl(day: string): string {
        return `${URLS.matchSummary}${encodeURIComponent(day)}.json`;
    }


    /** Maps supported football action codes to normalized action names. */
    filterFootballActions(
        data: { sportCodes: { disciplineCode: string; entityCode: string; sportCode: string }[] }
    ): Record<string, string> {
        const result: Record<string, string> = {};
        for (const item of data.sportCodes) {
            if (item.disciplineCode !== 'FBL' || item.entityCode !== '@Action') {
                continue;
            }
            const type = FOOTBALL_ACTION_TYPES.get(item.sportCode);
            if (type !== undefined) {
                result[item.sportCode] = type;
            }
        }
        return result;
    }

    /** Converts raw schedules into match summaries with teams, scores, and locations. */
    transformSchedules(data: { schedules: any; }): MatchSummary[] {
        return (data.schedules || []).map((schedule: {
            result: { periods: any; };
            startDate: any;
            order: any;
            eventUnit: { description: any; resultRSC: any; };
            start: any;
            location: { longDescription: any; };
        }) => {
            const finalPeriod = (schedule.result?.periods || []).find(
                (period: { p_code: string; }) => period.p_code === 'TOT'
            );

            return {
                timeAndOrder: {
                    startDate: schedule.startDate,
                    order: schedule.order
                },

                event: {
                    description: schedule.eventUnit?.description,
                    resultRSC: schedule.eventUnit?.resultRSC,
                    participants: (schedule.start || []).map((start: { participant: any; startParticipant: any; }) => {
                        const participant = start.participant || start.startParticipant;

                        return {
                            code: participant?.organisation?.code ?? null,
                            description: participant?.organisation?.description ?? null
                        };
                    })
                },

                result: {
                    homeScore: finalPeriod?.home?.score ?? null,
                    awayScore: finalPeriod?.away?.score ?? null
                },

                location: {
                    longDescription: schedule.location?.longDescription
                }
            };
        }).filter((match: MatchSummary) =>
            !/^(?:Women's|Men's) Victory Ceremony$/i.test(match.event.description?.trim() ?? ''),
        );
    }

    /** Converts raw match data into details including lineups, scores, and scorers. */
    transformMatchDetails(match: any, footballSymbols: any): ExampleMatch {
        const result = match.result ?? match.results ?? {};

        /** Finds an event entry by code and returns its value. */
        const getEntryValue = (
            entries: any[] = [],
            code: string
        ): string | null => {
            const entry = entries.find(
                e =>
                    e.eue_code === code ||
                    e.code === code
            );

            return (
                entry?.eue_value ??
                entry?.value ??
                null
            );
        };

        /** Finds the result period matching the requested code. */
        const getPeriod = (
            periods: any[] = [],
            code: string
        ) => periods.find(p => p.p_code === code);

        /** Builds the match label from extended display information. */
        const getDisplayValue = (
            extendedInfos: any[] = []
        ): string | null => {
            return (
                'Match ' + (extendedInfos.find(
                    info => info.ei_type === 'DISPLAY'
                )?.ei_value ?? null)
            );
        };

        const homeTeam = result.items?.find(
            (item: any) =>
                getEntryValue(
                    item.eventUnitEntries,
                    'HOME_AWAY'
                ) === 'HOME'
        );

        const awayTeam = result.items?.find(
            (item: any) =>
                getEntryValue(
                    item.eventUnitEntries,
                    'HOME_AWAY'
                ) === 'AWAY'
        );

        const totalPeriod = getPeriod(
            result.periods,
            'TOT'
        );

        const firstHalf = getPeriod(
            result.periods,
            'H1'
        );

        /** Extracts the city from the last part of a comma-separated location. */
        const extractCity = (
            locationDescription?: string
        ): string | null => {
            if (!locationDescription) {
                return null;
            }

            const parts = locationDescription
                .split(',')
                .map(x => x.trim());

            return parts.length > 1
                ? parts[parts.length - 1]
                : null;
        };

        /** Maps an athlete to a player with a name, shirt number, and position. */
        const buildPlayer = (
            athlete: any
        ): Player => ({
            name:
                athlete?.athlete?.givenName + ' ' +
                athlete?.athlete?.familyName,
            number: athlete?.bib ?? null,
            position: getEntryValue(
                athlete?.eventUnitEntries,
                'POSITION'
            )
        });

        type ScoringAthlete = {
            participantCode?: string;
            athlete?: { givenName?: string | null; familyName?: string | null };
        };
        type ScoringTeam = {
            teamAthletes?: ScoringAthlete[] | null;
            participant?: {
                description?: string | null;
                name?: string | null;
                organisation?: { description?: string | null; code?: string | null };
            };
        };
        type ScoringAction = {
            pbpa_Result?: string;
            pbpa_Action?: string;
            pbpa_When?: string | null;
            competitors?: {
                athletes?: { pbpat_role?: string; pbpat_code?: string }[];
            }[];
        };

        /** Collects goals with scorer names, assists, countries, minutes, and action types. */
        const getScorers = (
            homeTeam: ScoringTeam | null | undefined,
            awayTeam: ScoringTeam | null | undefined,
            playByPlay: { actions?: ScoringAction[] | null }[] | null | undefined,
            footballSymbols: Record<string, string> | null | undefined
        ): Scorer[] => {
            const athletesByCode = new Map<string, { athlete: ScoringAthlete; country: string | null }>();
            for (const team of [homeTeam, awayTeam]) {
                const country = team?.participant?.organisation?.description
                    ?? team?.participant?.description
                    ?? team?.participant?.name
                    ?? team?.participant?.organisation?.code
                    ?? null;
                for (const athlete of team?.teamAthletes ?? []) {
                    const code = athlete.participantCode;
                    if (code && !athletesByCode.has(code)) {
                        athletesByCode.set(code, { athlete, country });
                    }
                }
            }

            /** Resolves an athlete code to a full name using the player index. */
            const getName = (code: string | undefined): string | null => {
                const athlete = code ? athletesByCode.get(code)?.athlete.athlete : undefined;
                return [athlete?.givenName, athlete?.familyName].filter(Boolean).join(' ') || null;
            };

            /** Converts a goal timestamp, including added time, to a numeric minute. */
            const getMinute = (value: string | null | undefined): number | null => {
                if (value == null || !value.trim()) {
                    return null;
                }
                const parts = value.match(/^\s*(\d+)\s*'*\s*(?:\+\s*(\d+)\s*'*)?\s*$/);
                if (!parts) {
                    throw new Error(`Invalid goal minute: ${value}`);
                }
                return Number(parts[1]) + Number(parts[2] ?? 0);
            };

            const scorers: Scorer[] = [];
            for (const period of playByPlay ?? []) {
                for (const action of period.actions ?? []) {
                    if (action.pbpa_Result !== 'GOAL') {
                        continue;
                    }
                    const athletes = action.competitors?.[0]?.athletes ?? [];
                    const scorerCode = athletes.find(athlete => athlete.pbpat_role === 'SCR')?.pbpat_code;
                    const assistantCode = athletes.find(athlete => athlete.pbpat_role === 'ASSIST')?.pbpat_code;
                    const assist = getName(assistantCode);
                    scorers.push({
                        team: scorerCode ? athletesByCode.get(scorerCode)?.country ?? null : null,
                        player: getName(scorerCode),
                        ...(assist !== null ? { assist } : {}),
                        minute: getMinute(action.pbpa_When),
                        type: action.pbpa_Action
                            ? footballSymbols?.[action.pbpa_Action]?.toLowerCase() ?? ''
                            : '',
                    });
                }
            }
            return scorers;
        };

        /** Builds a team's starters, substitutes, formation, and coaching staff. */
        const buildLineup = (
            team: any
        ): TeamLineup => {
            const athletes =
                team?.teamAthletes ?? [];

            const startingXI = athletes
                .filter((athlete: any) =>
                    athlete.eventUnitEntries?.some(
                        (entry: any) =>
                            entry.eue_code ===
                            'STARTER' &&
                            (entry.eue_value ===
                                'Y' ||
                                entry.value === 'Y')
                    )
                )
                .map(buildPlayer);

            const bench = athletes
                .filter(
                    (athlete: any) =>
                        !athlete.eventUnitEntries?.some(
                            (entry: any) =>
                                entry.eue_code ===
                                'STARTER' &&
                                (entry.eue_value ===
                                    'Y' ||
                                    entry.value ===
                                    'Y')
                        )
                )
                .map(buildPlayer);

            return {
                team:
                    team?.participant
                        ?.description ??
                    team?.participant?.name ??
                    null,

                formation: getEntryValue(
                    team?.eventUnitEntries,
                    'FORMATION'
                ),

                coach:
                    team?.teamCoaches?.find(
                        (coach: { function: { functionCode: string; }; }) => coach.function?.functionCode === 'COACH'
                    )?.coach?.name ?? null,

                coaches: (team?.teamCoaches ?? [])
                    .map((entry: { coach?: { name?: string | null } }) => entry.coach?.name)
                    .filter((name: string | null | undefined): name is string => Boolean(name)),

                startingXI,

                bench
            };
        };

        const competitionRound = [
            result?.eventUnit
                ?.shortDescription,
            getDisplayValue(
                result?.extendedInfos
            )
        ]
            .filter(Boolean)
            .join(', ');

        const locationDescription =
            result?.schedule?.location
                ?.description ??
            match?.location?.description ??
            null;

        const venueDescription =
            result?.schedule?.venue
                ?.description ??
            match?.venue?.description ??
            null;

        return {
            competition: {
                name: 'Olympic Games',
                season: '2024',

                round:
                    competitionRound || null
            },

            venue: {
                name: venueDescription,

                city: extractCity(
                    locationDescription
                )
            },

            kickoff:
                result?.schedule
                    ?.startDate ??
                match?.startDate ??
                null,

            status: getDisplayValue(
                result?.extendedInfos
            ),

            teams: {
                home:
                    homeTeam?.participant
                        ?.description ??
                    homeTeam?.participant
                        ?.name ??
                    null,

                away:
                    awayTeam?.participant
                        ?.description ??
                    awayTeam?.participant
                        ?.name ??
                    null
            },

            score: {
                home:
                    totalPeriod?.home
                        ?.score ?? null,

                away:
                    totalPeriod?.away
                        ?.score ?? null,

                halfTime: {
                    home:
                        firstHalf?.home
                            ?.score ?? null,

                    away:
                        firstHalf?.away
                            ?.score ?? null
                }
            },

            lineups: {
                home: buildLineup(homeTeam),
                away: buildLineup(awayTeam)
            },

            scorers: getScorers(homeTeam, awayTeam, result.playByPlay, footballSymbols)
        };
    }
}