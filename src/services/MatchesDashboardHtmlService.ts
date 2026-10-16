import type { MatchSummary } from '../models/MatchSummary';
import { FLAG_IMAGES } from '../constants/FlagImages';
import { PLAYER_POSITION_NAMES } from '../constants/FootballConstants';

import type {
    SortColumn, SortDirection, EventFilter, DetailsFormat, StatusKind,
    MatchDayView, MatchDetailsView, MatchDetailsCallbacks,
} from '../models/MatchesDashboardView';

export class MatchesDashboardHtmlService {
    private readonly daysListEl: HTMLUListElement;
    private readonly daysStatusEl: HTMLElement;
    private readonly matchesEl: HTMLElement;
    private readonly matchesStatusEl: HTMLElement;
    private readonly symbolsStatusEl: HTMLElement;

    /** Finds the required dashboard containers. */
    constructor() {
        const daysListEl = document.querySelector<HTMLUListElement>('#competition-days');
        const daysStatusEl = document.querySelector<HTMLElement>('#competition-days-status');
        const matchesEl = document.querySelector<HTMLElement>('#matches');
        const matchesStatusEl = document.querySelector<HTMLElement>('#matches-status');
        const symbolsStatusEl = document.querySelector<HTMLElement>('#football-symbols-status');
        if (!daysListEl || !daysStatusEl || !matchesEl || !matchesStatusEl || !symbolsStatusEl) {
            throw new Error('Dashboard elements are missing from the document.');
        }
        this.daysListEl = daysListEl;
        this.daysStatusEl = daysStatusEl;
        this.matchesEl = matchesEl;
        this.matchesStatusEl = matchesStatusEl;
        this.symbolsStatusEl = symbolsStatusEl;
    }

    /** Connects the filter dialog to the dashboard's filter state. */
    initializeFilters(getFilter: () => EventFilter, onFilter: (filter: EventFilter) => void): void {
        const button = document.querySelector<HTMLButtonElement>('#filters-button');
        const dialog = document.querySelector<HTMLDialogElement>('#filters-dialog');
        const form = document.querySelector<HTMLFormElement>('#filters-form');
        const cancel = document.querySelector<HTMLButtonElement>('#filters-cancel');
        if (!button || !dialog || !form || !cancel) {
            throw new Error('Filter elements are missing from the document.');
        }
        button.addEventListener('click', () => {
            form.querySelectorAll<HTMLInputElement>('input[name="event-filter"]').forEach(input => {
                input.checked = input.value === getFilter();
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
            onFilter(value);
            dialog.close();
        });
    }

    /** Updates the competition days status message. */
    setDaysStatus(message: string, kind: StatusKind = 'loading', retry?: () => void): void {
        this.updateStatus(this.daysStatusEl, message, kind, retry);
    }

    setMatchesStatus(message: string, kind: StatusKind = 'loading', retry?: () => void): void {
        this.updateStatus(this.matchesStatusEl, message, kind, retry);
    }

    setSymbolsStatus(message: string): void {
        this.updateStatus(this.symbolsStatusEl, message, 'warning');
    }

    /** Updates the competition days loading state. */
    setDaysBusy(busy: boolean): void {
        this.daysListEl.setAttribute('aria-busy', String(busy));
        this.matchesEl.setAttribute('aria-busy', String(busy));
    }

    /** Creates a dated competition day button and its list item. */
    createDayItem(day: string, onSelect: (day: string, button: HTMLButtonElement) => void): HTMLLIElement {
        const formatter = new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
        });
        const date = new Date(day);
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => onSelect(day, button));
        const time = document.createElement('time');
        time.dateTime = day;
        const dayMonth = document.createElement('span');
        dayMonth.textContent = formatter.format(date);
        const year = document.createElement('span');
        year.textContent = String(date.getUTCFullYear());
        time.append(dayMonth, document.createTextNode(' '), year);
        button.append(time);
        item.append(button);
        return item;
    }

    /** Displays day buttons after All days and returns the first dated button. */
    renderDays(items: HTMLLIElement[], onSelectAll: (button: HTMLButtonElement) => void): HTMLButtonElement | null {
        if (!items.length) {
            this.daysListEl.replaceChildren();
            return null;
        }
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'All days';
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => onSelectAll(button));
        item.append(button);
        this.daysListEl.replaceChildren(item, ...items);
        return items[0]?.querySelector('button') ?? null;
    }

    /** Marks only the selected competition day button as pressed. */
    selectDay(selectedButton: HTMLButtonElement): void {
        this.daysListEl.querySelectorAll('button').forEach(button => {
            button.setAttribute('aria-pressed', String(button === selectedButton));
        });
    }

    /** Replaces the matches table with an empty-state message. */
    showEmptyMatches(message: string): void {
        this.matchesEl.replaceChildren();
        this.setMatchesStatus(message, 'empty');
    }

    /** Restores focus to a sort button after rendering. */
    focusSort(column: SortColumn): void {
        this.matchesEl.querySelector<HTMLButtonElement>(`button[data-sort="${column}"]`)?.focus();
    }

    /** Renders grouped match rows with sortable headings and details controls. */
    renderMatches(
        days: MatchDayView[],
        sortColumn: SortColumn,
        sortDirection: SortDirection,
        onSort: (column: SortColumn, active: boolean) => void,
        getStartTimestamp: (startDate: string) => number,
        attachDetails: (row: HTMLTableRowElement, match: MatchSummary) => void,
    ): void {
        const table = document.createElement('table');
        table.setAttribute('aria-labelledby', 'matches-heading');
        const header = table.createTHead().insertRow();
        for (const [column, title] of [
            ['time', 'Time (UTC)'], ['event', 'Event'], ['result', 'Result'], ['location', 'Location'],
        ] as const) {
            const cell = document.createElement('th');
            cell.scope = 'col';
            const active = column === sortColumn;
            cell.setAttribute('aria-sort', active ? sortDirection : 'none');
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.sort = column;
            button.textContent = `${title} ${active ? (sortDirection === 'ascending' ? '\u2191' : '\u2193') : '\u2195'}`;
            button.setAttribute('aria-label', `${title}: sort ${active && sortDirection === 'ascending' ? 'descending' : 'ascending'}`);
            button.addEventListener('click', () => onSort(column, active));
            cell.append(button);
            header.append(cell);
        }
        const actionsHeader = document.createElement('th');
        actionsHeader.scope = 'col';
        actionsHeader.textContent = 'Actions';
        header.append(actionsHeader);
        const dateFormatter = new Intl.DateTimeFormat('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
        });
        const timeFormatter = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
        });
        for (const { date, matches } of days) {
            const body = table.createTBody();
            const dateCell = document.createElement('th');
            dateCell.scope = 'rowgroup';
            dateCell.colSpan = 5;
            dateCell.className = 'match-day-heading';
            dateCell.textContent = dateFormatter.format(new Date(date));
            body.insertRow().append(dateCell);
            if (!matches.length) {
                const emptyCell = body.insertRow().insertCell();
                emptyCell.colSpan = 5;
                emptyCell.textContent = 'No matches for this day.';
            }
            for (const match of matches) {
                const row = body.insertRow();
                const startDate = match.timeAndOrder.startDate;
                row.insertCell().textContent = startDate
                    ? timeFormatter.format(new Date(getStartTimestamp(startDate)))
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
                        const flag = this.createFlag(participant.code, participant.description ?? participant.code);
                        if (flag) participantEl.prepend(flag);
                    }
                    participants.append(participantEl);
                }
                eventColumns.append(description, participants);
                eventCell.append(eventColumns);
                const resultCell = row.insertCell();
                for (const [label, score] of [
                    ['Home score', match.result.homeScore], ['Away score', match.result.awayScore],
                ] as const) {
                    const scoreEl = document.createElement('div');
                    scoreEl.className = 'match-score';
                    scoreEl.textContent = String(score ?? '-');
                    scoreEl.setAttribute('aria-label', `${label}: ${score ?? 'Not available'}`);
                    resultCell.append(scoreEl);
                }
                row.insertCell().textContent = match.location.longDescription ?? 'Not available';
                attachDetails(row, match);
            }
        }
        this.matchesEl.replaceChildren(table);
        const count = days.reduce((total, day) => total + day.matches.length, 0);
        this.setMatchesStatus(`${count} ${count === 1 ? 'match' : 'matches'} shown.`, 'success');
    }

    /** Adds details controls and returns a controller for their rendered content. */
    attachMatchDetails(
        row: HTMLTableRowElement,
        match: MatchSummary,
        callbacks: MatchDetailsCallbacks,
    ): MatchDetailsView {
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
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-atomic', 'true');
        const detailsContent = document.createElement('div');
        detailsContent.className = 'match-details-content';
        detailsContent.setAttribute('aria-busy', 'false');
        panel.append(status, detailsContent);
        cell.append(panel);
        row.after(detailsRow);

        const button = this.createDetailsButton('Display details (JSON result format)');
        button.setAttribute('aria-expanded', 'false');
        const actionsCell = row.insertCell();
        const graphicalButton = this.createDetailsButton('Display details (graphical format)');
        graphicalButton.setAttribute('aria-expanded', 'false');
        const originalButton = this.createDetailsButton('Display details (original JSON format)');
        originalButton.setAttribute('aria-expanded', 'false');
        const directDownloadButton = this.createDetailsButton('Download JSON result content');
        const downloadStatus = document.createElement('p');
        downloadStatus.setAttribute('role', 'status');
        downloadStatus.setAttribute('aria-live', 'polite');
        downloadStatus.setAttribute('aria-atomic', 'true');
        let copyButton: HTMLButtonElement | undefined;
        actionsCell.append(graphicalButton, originalButton, button, directDownloadButton, downloadStatus);
        row.classList.add('match-summary-row');
        directDownloadButton.addEventListener('click', event => {
            event.stopPropagation();
            callbacks.onDirectDownload();
        });
        graphicalButton.addEventListener('click', event => {
            event.stopPropagation();
            callbacks.onToggle('graphical');
        });
        originalButton.addEventListener('click', event => {
            event.stopPropagation();
            callbacks.onToggle('original');
        });
        row.addEventListener('click', () => callbacks.onToggle('json'));

        return {
            /** Updates details visibility and format button labels. */
            setFormat: format => {
                detailsRow.hidden = format === null;
                for (const [control, mode] of [[button, 'json'], [graphicalButton, 'graphical'], [originalButton, 'original']] as const) {
                    const expanded = format === mode;
                    control.setAttribute('aria-expanded', String(expanded));
                    control.textContent = `${expanded ? 'Hide' : 'Display'} details (${mode === 'json' ? 'JSON' : mode} format)`;
                }
            },
            /** Removes rendered details while keeping the status element. */
            resetContent: () => {
                copyButton = undefined;
                detailsContent.replaceChildren();
                this.updateStatus(status, '', 'loading');
            },
            /** Sets the details status message. */
            setStatus: (message, kind = 'loading', retry) => this.updateStatus(status, message, kind, retry),
            /** Marks the details panel as loading or idle. */
            setBusy: busy => detailsContent.setAttribute('aria-busy', String(busy)),
            /** Updates the download button and optionally its status message. */
            setDownloadState: (busy, message, kind = 'loading') => {
                directDownloadButton.disabled = busy;
                directDownloadButton.setAttribute('aria-busy', String(busy));
                panel.querySelector<HTMLButtonElement>('[data-download]')?.toggleAttribute('disabled', busy);
                if (message !== undefined) {
                    this.updateStatus(downloadStatus, message, kind);
                }
            },
            setCopyState: (busy, message, kind = 'loading') => {
                if (copyButton) {
                    copyButton.disabled = busy;
                    copyButton.setAttribute('aria-busy', String(busy));
                }
                this.updateStatus(status, message, kind);
            },
            /** Appends the original response as formatted JSON. */
            showOriginal: details => {
                const content = document.createElement('pre');
                content.textContent = JSON.stringify(details, null, 2);
                this.updateStatus(status, '', 'success');
                detailsContent.append(content);
            },
            /** Appends graphical lineups or JSON with copy and download controls. */
            showDetails: (details, format) => {
                let content: HTMLElement;
                if (format === 'graphical') {
                    content = this.createGraphicalDetails(details, match);
                } else {
                    content = document.createElement('pre');
                    const json = JSON.stringify(details, null, 2);
                    content.textContent = json;
                    copyButton = this.createDetailsButton('Copy JSON to clipboard');
                    copyButton.addEventListener('click', () => callbacks.onCopy(json));
                    const downloadButton = this.createDetailsButton('Download JSON content');
                    downloadButton.dataset.download = '';
                    downloadButton.disabled = directDownloadButton.disabled;
                    downloadButton.addEventListener('click', callbacks.onDirectDownload);
                    const downloadActions = document.createElement('div');
                    downloadActions.className = 'json-download-actions';
                    downloadActions.append(downloadButton, copyButton);
                    detailsContent.append(downloadActions);
                }
                this.updateStatus(status, '', 'success');
                detailsContent.append(content);
            },
        };
    }

    private updateStatus(element: HTMLElement, message: string, kind: StatusKind, retry?: () => void): void {
        element.className = `dashboard-status status-${kind}`;
        element.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        element.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
        element.setAttribute('aria-atomic', 'true');
        element.replaceChildren();
        if (!message) return;
        const text = document.createElement('span');
        text.textContent = message;
        element.append(text);
        if (retry) {
            const button = this.createDetailsButton('Retry');
            button.addEventListener('click', event => {
                event.stopPropagation();
                retry();
            });
            element.append(button);
        }
    }

    /** Downloads JSON through a temporary link and releases its object URL. */
    downloadJson(json: string, filename: string): void {
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.append(link);
        try {
            link.click();
        } finally {
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }

    /** Creates a consistently styled details action button. */
    private createDetailsButton(label: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'match-details-toggle';
        button.textContent = label;
        return button;
    }

    /** Creates an accessible team flag when its image is available. */
    private createFlag(code: string, description: string, lineup = false): HTMLImageElement | null {
        const flagUrl = FLAG_IMAGES[`../../resources/images/flags/${code}.webp`];
        if (!flagUrl) {
            console.warn(`Flag image is missing for organisation code: ${code}`);
            return null;
        }
        const flag = document.createElement('img');
        flag.src = flagUrl;
        flag.alt = `${description} flag`;
        flag.className = lineup ? 'participant-flag lineup-flag' : 'participant-flag';
        return flag;
    }

    /** Builds team lineups with flags, positions, goals, formations, and coaches. */
    private createGraphicalDetails(details: ExampleMatch, match: MatchSummary): HTMLElement {
        const layout = document.createElement('div');
        layout.className = 'graphical-match-details';
        const lineups = document.createElement('div');
        lineups.className = 'match-lineups';
        for (const side of ['home', 'away'] as const) {
            const lineup = details.lineups[side];
            const table = document.createElement('table');
            const caption = table.createCaption();
            caption.textContent = lineup.team ?? details.teams[side] ?? (side === 'home' ? 'Home team' : 'Away team');
            const participant = match.event.participants.find(participant =>
                participant.description != null
                && (participant.description === lineup.team || participant.description === details.teams[side]),
            ) ?? match.event.participants[side === 'home' ? 0 : 1];
            if (participant?.code) {
                const flag = this.createFlag(participant.code, caption.textContent, true);
                if (flag) caption.append(flag);
            }
            const header = table.createTHead().insertRow();
            for (const title of ['Player', 'Position']) {
                const cell = document.createElement('th');
                cell.scope = 'col';
                cell.textContent = title;
                header.append(cell);
            }
            for (const [title, players] of [
                ['Starting XI', lineup.startingXI], ['Substitutes', lineup.bench],
            ] as const) {
                const body = table.createTBody();
                const groupHeading = document.createElement('th');
                groupHeading.scope = 'rowgroup';
                groupHeading.colSpan = 2;
                groupHeading.textContent = title;
                body.insertRow().append(groupHeading);
                if (!players.length) {
                    const cell = body.insertRow().insertCell();
                    cell.colSpan = 2;
                    cell.textContent = `${title} not available.`;
                }
                for (const player of players) {
                    const row = body.insertRow();
                    const playerCell = row.insertCell();
                    playerCell.textContent = player.name;
                    const goals = details.scorers.filter(scorer =>
                        scorer.player === player.name
                        && (scorer.team === lineup.team || scorer.team === details.teams[side]),
                    );
                    if (goals.length) {
                        const goalInfo = document.createElement('span');
                        goalInfo.className = 'player-goals';
                        const minutes = goals.filter(goal => goal.minute !== null).map(goal => `${goal.minute}'`);
                        goalInfo.textContent = ` - ${goals.length === 1 ? 'Goal' : `${goals.length} goals`}${minutes.length ? ` (${minutes.join(', ')})` : ''}`;
                        playerCell.append(goalInfo);
                    }
                    row.insertCell().textContent = player.position
                        ? PLAYER_POSITION_NAMES.get(player.position) ?? player.position
                        : 'Not available';
                }
            }
            const teamPanel = document.createElement('div');
            const formation = document.createElement('p');
            formation.textContent = `Formation: ${lineup.formation ?? 'Not available'}`;
            const coachesHeading = document.createElement('h3');
            coachesHeading.textContent = 'Coaches';
            const coaches = document.createElement('ul');
            for (const name of lineup.coaches) {
                const item = document.createElement('li');
                item.textContent = name;
                coaches.append(item);
            }
            if (!lineup.coaches.length) {
                const item = document.createElement('li');
                item.textContent = 'Not available';
                coaches.append(item);
            }
            teamPanel.append(table, formation, coachesHeading, coaches);
            lineups.append(teamPanel);
        }
        const secondRow = document.createElement('div');
        secondRow.className = 'match-details-second-row';
        layout.append(lineups, secondRow);
        return layout;
    }
}
