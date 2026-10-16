import type {CompetitionData} from '../models/CompetitionData';
import type {MatchSummary} from '../models/MatchSummary';

import {URLS} from './OlympicResultsUrls';

export class DataParser {
    extractCompetitionDates(data?: CompetitionData | null): string[] {
        return (data?.competition_schedule || [])
            .map(item => item.date)
            .filter((date): date is string => Boolean(date));
    }


    buildMatchSummaryUrl(day: string): string {
        return `${URLS.matchSummary}${encodeURIComponent(day)}.json`;
    }

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
        });
    }

    buildResultUrl(rscResult: string): string {
        return URLS.matchDetails.replace('#{idMatch}', rscResult);
    }

    transformMatchDetails(match: any): ExampleMatch {
        const getEntryValue = (
            entries: any[] = [],
            code: string
        ): string | null => {
            return entries.find(e => e.eue_code === code)?.value ?? null;
        };

        const getExtendedInfo = (
            infos: any[] = [],
            code: string
        ): string | null => {
            return infos.find(i => i.ei_code === code)?.ei_value ?? null;
        };

        const getPeriod = (periods: any[] = [], code: string) =>
            periods.find(p => p.p_code === code);

        const getHomeAwayFlag = (item: any) =>
            getEntryValue(item.eventUnitEntries, 'HOME_AWAY');

        const homeTeam = match.result?.items?.find(
            (i: any) => getHomeAwayFlag(i) === 'HOME'
        );

        const awayTeam = match.result?.items?.find(
            (i: any) => getHomeAwayFlag(i) === 'AWAY'
        );

        const totalScore = getPeriod(match.result?.periods, 'TOT');
        const firstHalf = getPeriod(match.result?.periods, 'H1');

        const buildPlayer = (athlete: any): Player => ({
            name:
                athlete?.athlete?.description ??
                athlete?.description ??
                athlete?.name ??
                '',
            number: athlete?.bib ?? null,
            position: getEntryValue(
                athlete?.eventUnitEntries,
                'POSITION'
            )
        });

        const buildLineup = (team: any): TeamLineup => {
            const athletes = team?.teamAthletes ?? [];

            const starters = athletes.filter((a: any) =>
                a.eventUnitEntries?.some(
                    (e: any) =>
                        e.eue_code === 'STARTER' &&
                        e.value === 'Y'
                )
            );

            const bench = athletes.filter(
                (a: any) =>
                    !a.eventUnitEntries?.some(
                        (e: any) =>
                            e.eue_code === 'STARTER' &&
                            e.value === 'Y'
                    )
            );

            const coach =
                team?.teamCoaches?.find(
                    (c: any) =>
                        c.functionCode === 'COACH'
                )?.description ?? null;

            return {
                team:
                    team?.participant?.description ??
                    team?.participant?.name ??
                    null,

                formation: getEntryValue(
                    team?.eventUnitEntries,
                    'FORMATION'
                ),

                coach,

                startingXI: starters.map(buildPlayer),

                bench: bench.map(buildPlayer)
            };
        };

        const createScorers = (): Scorer[] => {
            const actions =
                match?.playByPlay?.actions ?? [];

            const goals = actions.filter(
                (a: any) =>
                    a.pbpa_Result === 'GOAL'
            );

            return goals.map((goal: any) => {
                const scorerParticipant =
                    goal.participants?.find(
                        (p: any) => p.pbpat_role === 'SCR'
                    );

                const assistParticipant =
                    goal.participants?.find(
                        (p: any) => p.pbpat_role === 'ASSIST'
                    );

                const scoringTeamCode =
                    goal.competitor?.pbpc_code;

                const scoringTeam =
                    match.result?.items?.find(
                        (item: any) =>
                            item.teamCode === scoringTeamCode
                    );

                return {
                    player:
                        scorerParticipant?.description ??
                        scorerParticipant?.name ??
                        null,

                    assist:
                        assistParticipant?.description ??
                        assistParticipant?.name ??
                        null,

                    minute:
                        goal.pbpa_When ??
                        goal.when ??
                        null,

                    team:
                        scoringTeam?.participant?.description ??
                        scoringTeam?.participant?.name ??
                        null,

                    // brak jednoznacznego mapowania
                    type: null
                };
            });
        };

        const location =
            match.schedule?.location?.description ??
            '';

        const city =
            location.includes(',')
                ? location.split(',').pop()?.trim() ?? null
                : null;

        return {
            competition: {
                round:
                    match.eventUnit?.phase?.shortDescription ??
                    null,

                // brak odpowiedników
                name: 'Olympic Games',
                season: 'Day xyz'
            },

            venue: {
                name:
                    match.schedule?.venue?.description ??
                    null,

                city
            },

            kickoff:
                match.schedule?.startDate ?? null,

            status:
                getExtendedInfo(
                    match.extendedInfos,
                    'PERIOD'
                ) ?? null,

            teams: {
                home:
                    homeTeam?.participant?.description ??
                    homeTeam?.participant?.name ??
                    null,

                away:
                    awayTeam?.participant?.description ??
                    awayTeam?.participant?.name ??
                    null
            },

            score: {
                home:
                    totalScore?.home?.score ??
                    null,

                away:
                    totalScore?.away?.score ??
                    null,

                halfTime: {
                    home:
                        firstHalf?.home?.score ??
                        null,

                    away:
                        firstHalf?.away?.score ??
                        null
                }
            },

            lineups: {
                home: buildLineup(homeTeam),
                away: buildLineup(awayTeam)
            },

            scorers: createScorers()
        };
    }
}