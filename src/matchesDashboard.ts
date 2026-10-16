import { OlympicResultsApi } from './services/OlympicResultsApi';
import { DataParser } from './services/DataParser';
import { MatchesDashboardHtmlService } from './services/MatchesDashboardHtmlService';
import type { DetailsFormat, EventFilter, SortColumn, SortDirection } from './models/MatchesDashboardView';
import './styles/matchesDashboard.css';
import type { MatchSummary } from './models/MatchSummary';
import {OlympicMatchData} from './models/OlympicMatchData';

class EmptyMatchDetailsError extends Error {}

export class MatchesDashboard {

    protected competitionDays: string[] = [];
    protected matchesForEachDay: Record<string, Awaited<ReturnType<OlympicResultsApi['getMatchSummary']>>> = {};
    private selectedDay: string | null = null;
    private eventFilter: EventFilter = 'all';
    private sortColumn: SortColumn = 'time';
    private sortDirection: SortDirection = 'ascending';
    private footballSymbols: Awaited<ReturnType<OlympicResultsApi['getSportCodes']>> | undefined;
    private initialState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';

    constructor(
        private readonly olympicResultsApi = new OlympicResultsApi(),
        private readonly dataExtractor = new DataParser(),
        private readonly htmlService = new MatchesDashboardHtmlService(),
    ) {
        this.htmlService.initializeFilters(
            () => this.eventFilter,
            filter => {
                this.eventFilter = filter;
                this.renderMatches();
            },
        );
        void this.initializeFootballSymbols();
        void this.initializeDates();
    }

    private async initializeFootballSymbols(): Promise<void> {
        this.htmlService.setSymbolsStatus('Football action labels are loading. Early JSON results may not include goal types.');
        try {
            this.footballSymbols = await this.olympicResultsApi.getSportCodes();
            this.htmlService.setSymbolsStatus('');
        } catch (error) {
            this.htmlService.setSymbolsStatus('Football action labels could not be loaded. Matches and details are still available, but goal types may be missing from JSON results.');
            console.error('Failed to load football symbols:', error);
        }
    }

    private getFilteredMatches(day: string) {
        return this.matchesForEachDay[day].filter(match => {
            if (this.eventFilter === 'all') {
                return true;
            }
            const category = this.eventFilter === 'men' ? /\bmen\b/i : /\bwomen\b/i;
            return category.test(match.event.description ?? '');
        });
    }

    /**
     * Initialization of competition days information
     * @private
     */
    private async initializeDates(): Promise<void> {
        if (this.initialState === 'loading') return;
        this.initialState = 'loading';
        this.htmlService.setDaysStatus('Loading competition days and matches...');
        this.htmlService.setMatchesStatus('Loading matches. Please wait before viewing results.');
        this.htmlService.setDaysBusy(true);

        try {
            const competitionDates = await this.olympicResultsApi.getCompetitionDates();
            const competitionDays = this.dataExtractor.extractCompetitionDates(competitionDates);
            // Settle every request before enabling retry, so failed batches cannot overlap.
            const results = await Promise.allSettled(competitionDays.map(async day => {
                const item = this.htmlService.createDayItem(day, (date, button) => this.selectDay(date, button));
                const matches = await this.olympicResultsApi.getMatchSummary(day);
                return { day, item, matches };
            }));
            const daysWithMatches = results.map(result => {
                if (result.status === 'rejected') throw result.reason;
                return result.value;
            });

            const daysLiItems = daysWithMatches.map(({ item }) => item);
            this.competitionDays = competitionDays;
            this.matchesForEachDay = Object.fromEntries(
                daysWithMatches.map(({ day, matches }) => [day, matches]),
            );
            const firstDayButton = this.htmlService.renderDays(daysLiItems, button => this.selectDay(null, button));
            this.initialState = 'ready';
            this.htmlService.setDaysStatus(daysLiItems.length ? '' : 'No competition days available.', 'empty');
            const firstDay = this.competitionDays[0];
            if (firstDay !== undefined && firstDayButton) {
                this.selectDay(firstDay, firstDayButton);
            } else {
                this.renderMatches();
            }
        } catch (error) {
            this.initialState = 'error';
            this.htmlService.setDaysStatus('Competition days and matches could not be loaded. Check your connection and retry.', 'error', () => {
                void this.initializeDates();
            });
            this.htmlService.setMatchesStatus('Matches are unavailable because the schedule could not be loaded. Use Retry above.', 'error');
            console.error('Failed to load competition days and matches:', error);
        } finally {
            this.htmlService.setDaysBusy(false);
        }
    }

    private selectDay(day: string | null, selectedButton: HTMLButtonElement): void {
        this.selectedDay = day;
        this.htmlService.selectDay(selectedButton);
        this.renderMatches();
    }

    private renderMatches(): void {
        if (this.initialState !== 'ready') return;
        try {
            this.renderReadyMatches();
        } catch (error) {
            this.htmlService.showEmptyMatches('');
            this.htmlService.setMatchesStatus('Matches could not be displayed because the schedule contains invalid data. Try another day or filter, or retry.', 'error', () => this.renderMatches());
            console.error('Failed to display matches:', error);
        }
    }

    private renderReadyMatches(): void {
        if (!this.competitionDays.length) {
            this.htmlService.showEmptyMatches('No matches available because no competition days were returned.');
            return;
        }
        const day = this.selectedDay;
        const days = day === null ? this.competitionDays : [day];
        if (!days.some(date => this.getFilteredMatches(date).length)) {
            this.htmlService.showEmptyMatches(this.eventFilter !== 'all'
                ? 'No matches found for the selected filters.'
                : day === null ? 'No matches available.' : 'No matches for this day.');
            return;
        }

        const matchDays = days.map(date => ({
            date,
            matches: this.getFilteredMatches(date).sort((first, second) => this.compareMatches(first, second)),
        })).filter(({ matches }) => this.eventFilter === 'all' || matches.length);
        this.htmlService.renderMatches(
            matchDays,
            this.sortColumn,
            this.sortDirection,
            (column, active) => {
                this.sortDirection = active && this.sortDirection === 'ascending' ? 'descending' : 'ascending';
                this.sortColumn = column;
                this.renderMatches();
                this.htmlService.focusSort(column);
            },
            startDate => this.getStartTimestamp(startDate),
            (row, match) => this.attachMatchDetails(row, match),
        );
    }

    private attachMatchDetails(row: HTMLTableRowElement, match: MatchSummary): void {
        let activeFormat: DetailsFormat | null = null;
        let originalDetailsPromise: Promise<unknown> | undefined;
        let detailsPromise: Promise<ExampleMatch> | undefined;
        const missingId = !match.event.resultRSC?.trim();
        const missingIdMessage = 'Match details are unavailable: missing match identifier. This match cannot be downloaded.';
        const getOriginalDetails = (): Promise<unknown> => {
            const idMatch = match.event.resultRSC;
            if (!idMatch?.trim()) {
                return Promise.reject(new Error('Missing match identifier.'));
            }
            if (!originalDetailsPromise) {
                originalDetailsPromise = this.olympicResultsApi.getMatchDetails(idMatch)
                    .then(details => {
                        if (details == null || (typeof details === 'object' && !Object.keys(details).length)) {
                            throw new EmptyMatchDetailsError('No match details were returned.');
                        }
                        if (typeof details !== 'object' || Array.isArray(details)) {
                            throw new Error('The match details response is empty or invalid.');
                        }
                        const result = (details as OlympicMatchData).result ?? (details as OlympicMatchData).results;
                        if (!result || typeof result !== 'object' || Array.isArray(result)
                            || ![result.items, result.periods, result.extendedInfos, result.eventUnit, result.schedule, result.playByPlay]
                                .some(value => value && typeof value === 'object' && Object.keys(value).length)) {
                            throw new EmptyMatchDetailsError('No match details were returned.');
                        }
                        return details;
                    })
                    .catch(error => {
                        originalDetailsPromise = undefined;
                        throw error;
                    });
            }
            return originalDetailsPromise;
        };
        const getDetails = (): Promise<ExampleMatch> => {
            if (!detailsPromise) {
                detailsPromise = getOriginalDetails()
                    .then(details => this.dataExtractor.transformMatchDetails(<OlympicMatchData>details, this.footballSymbols))
                    .catch(error => {
                        detailsPromise = undefined;
                        throw error;
                    });
            }
            return detailsPromise;
        };
        let downloading = false;
        const directDownload = async (): Promise<void> => {
            if (downloading) return;
            if (missingId) {
                view.setDownloadState(false, missingIdMessage, 'error');
                return;
            }
            downloading = true;
            view.setDownloadState(true, 'Preparing JSON download...');
            try {
                this.downloadMatchJson(await getDetails(), match);
                view.setDownloadState(true, '');
            } catch (error) {
                view.setDownloadState(true, error instanceof EmptyMatchDetailsError
                    ? 'No match details are available to download. Try Download again later.'
                    : 'JSON could not be downloaded. Use Download again to retry.',
                error instanceof EmptyMatchDetailsError ? 'empty' : 'error');
                console.error('Failed to download JSON:', error);
            } finally {
                downloading = false;
                view.setDownloadState(false);
            }
        };
        const copyJson = async (json: string): Promise<void> => {
            const version = requestVersion;
            if (copyingVersion === version) return;
            copyingVersion = version;
            view.setCopyState(true, 'Copying JSON to the clipboard...');
            try {
                await navigator.clipboard.writeText(json);
                if (version === requestVersion) view.setCopyState(false, 'JSON copied to the clipboard.', 'success');
            } catch (error) {
                if (version === requestVersion) {
                    view.setCopyState(false, 'JSON could not be copied. Allow clipboard access on HTTPS or localhost, then try Copy again.', 'error');
                }
                console.error('Failed to copy JSON to the clipboard:', error);
            } finally {
                if (copyingVersion === version) copyingVersion = undefined;
            }
        };
        let copyingVersion: number | undefined;
        let requestVersion = 0;
        const toggle = async (format: DetailsFormat, retry = false): Promise<void> => {
            activeFormat = !retry && activeFormat === format ? null : format;
            const version = ++requestVersion;
            view.setFormat(activeFormat);
            view.setBusy(false);
            if (activeFormat === null) {
                return;
            }

            view.resetContent();
            if (missingId) {
                view.setStatus(missingIdMessage, 'error');
                return;
            }

            view.setBusy(true);
            view.setStatus('Loading match details...');
            try {
                if (format === 'original') {
                    const originalDetails = await getOriginalDetails();
                    if (version !== requestVersion) {
                        return;
                    }
                    view.showOriginal(originalDetails);
                    return;
                }
                const parsedDetails = await getDetails();
                if (version !== requestVersion) {
                    return;
                }
                view.showDetails(parsedDetails, format);
            } catch (error) {
                if (version !== requestVersion) {
                    return;
                }
                view.setStatus(error instanceof EmptyMatchDetailsError
                    ? 'No match details are available for this match. Please retry later.'
                    : 'Match details could not be loaded or displayed. Please retry.',
                error instanceof EmptyMatchDetailsError ? 'empty' : 'error', () => {
                    void toggle(format, true);
                });
                console.error('Failed to load match details:', error);
            } finally {
                if (version === requestVersion) {
                    view.setBusy(false);
                }
            }
        };
        const view = this.htmlService.attachMatchDetails(row, match, {
            onToggle: format => { void toggle(format); },
            onDirectDownload: () => { void directDownload(); },
            onCopy: json => { void copyJson(json); },
        });
    }

    private downloadMatchJson(details: ExampleMatch, match: MatchSummary): void {
        const json = JSON.stringify(details, null, 2);
        const home = details.teams.home ?? match.event.participants[0]?.description ?? 'Unknown home team';
        const away = details.teams.away ?? match.event.participants[1]?.description ?? 'Unknown away team';
        const matchDate = match.timeAndOrder.startDate ?? details.kickoff;
        const date = matchDate ? matchDate.slice(0, 10) : 'Unknown date';
        const filename = `${home}-${away}-${date}`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') + '.json';
        this.htmlService.downloadJson(json, filename);
    }

    private compareMatches(first: MatchSummary, second: MatchSummary): number {
        const compareNumbers = (a: number, b: number): number => a === b ? 0 : a < b ? -1 : 1;
        const numericValue = (value: number | string | null | undefined): number => {
            if (value == null) {
                return Infinity;
            }
            const number = Number(value);
            if (!Number.isFinite(number)) {
                throw new Error(`Invalid numeric match value: ${value}`);
            }
            return number;
        };
        const compareTime = () =>
            compareNumbers(this.getStartTimestamp(first.timeAndOrder.startDate), this.getStartTimestamp(second.timeAndOrder.startDate))
            || compareNumbers(numericValue(first.timeAndOrder.order), numericValue(second.timeAndOrder.order));
        const eventText = (match: MatchSummary) =>
            [match.event.description, ...match.event.participants.map(participant => participant.description)].join(' ');
        let comparison: number;
        switch (this.sortColumn) {
            case 'time':
                comparison = compareTime();
                break;
            case 'event':
                comparison = eventText(first).localeCompare(eventText(second), 'en', { numeric: true });
                break;
            case 'result':
                comparison = compareNumbers(numericValue(first.result.homeScore), numericValue(second.result.homeScore))
                    || compareNumbers(numericValue(first.result.awayScore), numericValue(second.result.awayScore));
                break;
            case 'location':
                comparison = (first.location.longDescription ?? '').localeCompare(second.location.longDescription ?? '', 'en', { numeric: true });
                break;
        }
        return (comparison || compareTime()) * (this.sortDirection === 'ascending' ? 1 : -1);
    }

    private getStartTimestamp(startDate: string | null | undefined): number {
        if (!startDate) {
            return Infinity;
        }
        const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(startDate)
            ? startDate
            : `${startDate}Z`;
        const value = Date.parse(timestamp);
        if (Number.isNaN(value)) {
            throw new Error(`Invalid match start date: ${startDate}`);
        }
        return value;
    }
}

new MatchesDashboard();
