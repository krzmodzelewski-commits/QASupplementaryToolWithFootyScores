import { OlympicResultsApi } from './services/OlympicResultsApi';
import { DataParser } from './services/DataParser';
import './matchesDashboard.css';
import type { MatchSummary } from './models/MatchSummary';

type SortColumn = 'time' | 'event' | 'result' | 'location';

const flagImages = import.meta.glob<string>('../resources/images/flags/*.webp', {
    eager: true,
    query: '?url',
    import: 'default',
});

export class MatchesDashboard {

    protected competitionDays: string[] = [];
    protected matchesForEachDay: Record<string, Awaited<ReturnType<OlympicResultsApi['getMatchSummary']>>> = {};
    private readonly daysListEl: HTMLUListElement;
    private readonly daysStatusEl: HTMLElement;
    private readonly matchesEl: HTMLElement;
    private selectedDay: string | null = null;
    private eventFilter: 'all' | 'men' | 'women' = 'all';
    private sortColumn: SortColumn = 'time';
    private sortDirection: 'ascending' | 'descending' = 'ascending';

    constructor(
        private readonly olympicResultsApi = new OlympicResultsApi(),
        private readonly dataExtractor = new DataParser(),
    ) {
        const daysListEl = document.querySelector<HTMLUListElement>('#competition-days');
        const daysStatusEl = document.querySelector<HTMLElement>('#competition-days-status');
        const matchesEl = document.querySelector<HTMLElement>('#matches');

        if (!daysListEl || !daysStatusEl || !matchesEl) {
            throw new Error('Dashboard elements are missing from the document.');
        }

        this.daysListEl = daysListEl;
        this.daysStatusEl = daysStatusEl;
        this.matchesEl = matchesEl;
        this.initializeFilters();
        void this.initializeDates();
    }

    private initializeFilters(): void {
        const button = document.querySelector<HTMLButtonElement>('#filters-button');
        const dialog = document.querySelector<HTMLDialogElement>('#filters-dialog');
        const form = document.querySelector<HTMLFormElement>('#filters-form');
        const cancel = document.querySelector<HTMLButtonElement>('#filters-cancel');
        if (!button || !dialog || !form || !cancel) {
            throw new Error('Filter elements are missing from the document.');
        }

        button.addEventListener('click', () => {
            form.querySelectorAll<HTMLInputElement>('input[name="event-filter"]').forEach(input => {
                input.checked = input.value === this.eventFilter;
            });
            dialog.showModal();
        });
        cancel.addEventListener('click', () => dialog.close());
        form.addEventListener('submit', event => {
            event.preventDefault();
            const value = new FormData(form).get('event-filter');
            if (value !== 'all' && value !== 'men' && value !== 'women') {
                throw new Error('Invalid event filter.');
            }
            this.eventFilter = value;
            this.renderMatches();
            dialog.close();
        });
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
        this.daysStatusEl.textContent = 'Loading competition days and matches...';
        this.daysListEl.setAttribute('aria-busy', 'true');

        try {
            const competitionDates = await this.olympicResultsApi.getCompetitionDates();
            this.competitionDays = this.dataExtractor.extractCompetitionDates(competitionDates);
            const dayMonthFormatter = new Intl.DateTimeFormat('en-GB', {
                day: 'numeric',
                month: 'long',
                timeZone: 'UTC',
            });
            const daysWithMatches = await Promise.all(this.competitionDays.map(async day => {
                const date = new Date(day);
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.setAttribute('aria-pressed', 'false');
                button.addEventListener('click', () => this.selectDay(day, button));
                const time = document.createElement('time');
                time.dateTime = day;
                const dayMonth = document.createElement('span');
                dayMonth.textContent = dayMonthFormatter.format(date);
                const year = document.createElement('span');
                year.textContent = String(date.getUTCFullYear());
                time.append(dayMonth, document.createTextNode(' '), year);
                button.append(time);
                item.append(button);
                const matches = await this.olympicResultsApi.getMatchSummary(day);
                return { day, item, matches };
            }));

            const daysLiItems = daysWithMatches.map(({ item }) => item);
            this.matchesForEachDay = Object.fromEntries(
                daysWithMatches.map(({ day, matches }) => [day, matches]),
            );
            const allDaysItem = document.createElement('li');
            const allDaysButton = document.createElement('button');
            allDaysButton.type = 'button';
            allDaysButton.textContent = 'All days';
            allDaysButton.setAttribute('aria-pressed', 'false');
            allDaysButton.addEventListener('click', () => this.selectDay(null, allDaysButton));
            allDaysItem.append(allDaysButton);
            this.daysListEl.replaceChildren(allDaysItem, ...daysLiItems);
            this.daysStatusEl.textContent = daysLiItems.length ? '' : 'No competition days available.';
            const firstDay = this.competitionDays[0];
            const firstDayButton = daysLiItems[0]?.querySelector('button');
            if (firstDay !== undefined && firstDayButton) {
                this.selectDay(firstDay, firstDayButton);
            }
        } catch (error) {
            this.daysStatusEl.textContent = 'Failed to load competition days and matches.';
            console.error('Failed to load competition days and matches:', error);
        } finally {
            this.daysListEl.setAttribute('aria-busy', 'false');
        }
    }

    private selectDay(day: string | null, selectedButton: HTMLButtonElement): void {
        this.selectedDay = day;
        this.daysListEl.querySelectorAll('button').forEach(button => {
            button.setAttribute('aria-pressed', String(button === selectedButton));
        });

        this.renderMatches();
    }

    private renderMatches(): void {
        const day = this.selectedDay;
        const days = day === null ? this.competitionDays : [day];
        if (!days.some(date => this.getFilteredMatches(date).length)) {
            this.matchesEl.textContent = this.eventFilter !== 'all'
                ? 'No matches found for the selected filters.'
                : day === null ? 'No matches available.' : 'No matches for this day.';
            return;
        }

        const table = document.createElement('table');
        table.setAttribute('aria-labelledby', 'matches-heading');
        const header = table.createTHead().insertRow();
        for (const [column, title] of [
            ['time', 'Time (UTC)'], ['event', 'Event'], ['result', 'Result'], ['location', 'Location'],
        ] as const) {
            const cell = document.createElement('th');
            cell.scope = 'col';
            const active = column === this.sortColumn;
            cell.setAttribute('aria-sort', active ? this.sortDirection : 'none');
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.sort = column;
            button.textContent = `${title} ${active ? (this.sortDirection === 'ascending' ? '\u2191' : '\u2193') : '\u2195'}`;
            button.setAttribute('aria-label', `${title}: sort ${active && this.sortDirection === 'ascending' ? 'descending' : 'ascending'}`);
            button.addEventListener('click', () => {
                this.sortDirection = active && this.sortDirection === 'ascending' ? 'descending' : 'ascending';
                this.sortColumn = column;
                this.renderMatches();
                this.matchesEl.querySelector<HTMLButtonElement>(`button[data-sort="${column}"]`)?.focus();
            });
            cell.append(button);
            header.append(cell);
        }

        const actionsHeader = document.createElement('th');
        actionsHeader.scope = 'col';
        actionsHeader.textContent = 'Actions';
        header.append(actionsHeader);

        const dateFormatter = new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        });
        const timeFormatter = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            timeZone: 'UTC',
        });

        for (const date of days) {
            const filteredMatches = this.getFilteredMatches(date);
            if (this.eventFilter !== 'all' && !filteredMatches.length) {
                continue;
            }
            const body = table.createTBody();
            const dateCell = document.createElement('th');
            dateCell.scope = 'rowgroup';
            dateCell.colSpan = 5;
            dateCell.className = 'match-day-heading';
            dateCell.textContent = dateFormatter.format(new Date(date));
            body.insertRow().append(dateCell);

            const matches = filteredMatches.sort((first, second) => this.compareMatches(first, second));
            if (!matches.length) {
                const emptyCell = body.insertRow().insertCell();
                emptyCell.colSpan = 5;
                emptyCell.textContent = 'No matches for this day.';
            }
            matches.forEach(match => {
            const row = body.insertRow();
            const startDate = match.timeAndOrder.startDate;
            row.insertCell().textContent = startDate
                ? timeFormatter.format(new Date(this.getStartTimestamp(startDate)))
                : 'Not available';

            const eventCell = row.insertCell();
            const eventColumns = document.createElement('div');
            eventColumns.className = 'match-event-columns';
            const description = document.createElement('div');
            description.className = 'match-description';
            description.textContent = match.event.description ?? 'Not available';
            const participants = document.createElement('div');
            for (const participant of match.event.participants) {
                const participantEl = document.createElement('div');
                participantEl.className = 'match-participant';
                participantEl.textContent = participant.description ?? 'Not available';
                if (participant.code) {
                    const flagUrl = flagImages[`../resources/images/flags/${participant.code}.webp`];
                    if (flagUrl) {
                        const flag = document.createElement('img');
                        flag.src = flagUrl;
                        flag.alt = `${participant.description ?? participant.code} flag`;
                        flag.className = 'participant-flag';
                        participantEl.prepend(flag);
                    } else {
                        console.warn(`Flag image is missing for organisation code: ${participant.code}`);
                    }
                }
                participants.append(participantEl);
            }
            eventColumns.append(description, participants);
            eventCell.append(eventColumns);

            const resultCell = row.insertCell();
            for (const [label, score] of [
                ['Home score', match.result.homeScore],
                ['Away score', match.result.awayScore],
            ] as const) {
                const scoreEl = document.createElement('div');
                scoreEl.className = 'match-score';
                scoreEl.textContent = String(score ?? '-');
                scoreEl.setAttribute('aria-label', `${label}: ${score ?? 'Not available'}`);
                resultCell.append(scoreEl);
            }

            row.insertCell().textContent = match.location.longDescription ?? 'Not available';
            this.attachMatchDetails(row, match);
        });
        }
        this.matchesEl.replaceChildren(table);
    }

    private attachMatchDetails(row: HTMLTableRowElement, match: MatchSummary): void {
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'match-details-row';
        detailsRow.hidden = true;
        const cell = detailsRow.insertCell();
        cell.colSpan = 5;
        const panel = document.createElement('div');
        panel.className = 'match-details-panel';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Match details');
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        panel.append(status);
        cell.append(panel);
        row.after(detailsRow);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'match-details-toggle';
        button.textContent = 'Show details';
        button.setAttribute('aria-expanded', 'false');
        row.insertCell().append(button);
        row.classList.add('match-summary-row');

        let loaded = false;
        let loading = false;
        const toggle = async (): Promise<void> => {
            detailsRow.hidden = !detailsRow.hidden;
            button.setAttribute('aria-expanded', String(!detailsRow.hidden));
            button.textContent = detailsRow.hidden ? 'Show details' : 'Hide details';
            if (detailsRow.hidden || loaded || loading) {
                return;
            }

            const idMatch = match.event.resultRSC;
            if (!idMatch?.trim()) {
                status.textContent = 'Match details are unavailable: missing match identifier.';
                return;
            }

            loading = true;
            panel.setAttribute('aria-busy', 'true');
            status.textContent = 'Loading match details...';
            try {
                const details = await this.olympicResultsApi.getMatchDetails(idMatch);
                const parsedDetails = this.dataExtractor.transformMatchDetails(details);
                const content = document.createElement('pre');
                content.textContent = JSON.stringify(parsedDetails, null, 2);
                status.textContent = '';
                panel.append(content);
                loaded = true;
            } catch (error) {
                status.textContent = 'Failed to load match details. Close and reopen to retry.';
                console.error('Failed to load match details:', error);
            } finally {
                loading = false;
                panel.setAttribute('aria-busy', 'false');
            }
        };

        row.addEventListener('click', () => { void toggle(); });
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