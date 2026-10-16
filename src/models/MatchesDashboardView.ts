import type { MatchSummary } from './MatchSummary';

export type SortColumn = 'time' | 'event' | 'result' | 'location';
export type SortDirection = 'ascending' | 'descending';
export type EventFilter = 'all' | 'men' | 'women';
export type DetailsFormat = 'json' | 'graphical' | 'original';
export type StatusKind = 'loading' | 'empty' | 'error' | 'warning' | 'success';

export interface MatchDayView {
    date: string;
    matches: MatchSummary[];
}

export interface MatchDetailsView {
    /** Updates the visible format and expanded button states. */
    setFormat(format: DetailsFormat | null): void;
    /** Clears details while retaining the status element. */
    resetContent(): void;
    /** Updates the details status message. */
    setStatus(message: string, kind?: StatusKind, retry?: () => void): void;
    /** Updates the details panel loading state. */
    setBusy(busy: boolean): void;
    /** Updates download availability and an optional status message. */
    setDownloadState(busy: boolean, message?: string, kind?: StatusKind): void;
    setCopyState(busy: boolean, message: string, kind?: StatusKind): void;
    /** Displays the original response as formatted JSON. */
    showOriginal(details: unknown): void;
    /** Displays transformed details as JSON or graphical lineups. */
    showDetails(details: ExampleMatch, format: 'json' | 'graphical'): void;
}

export interface MatchDetailsCallbacks {
    /** Requests a change to the displayed details format. */
    onToggle(format: DetailsFormat): void;
    /** Requests a download of the transformed match details. */
    onDirectDownload(): void;
    /** Copies the displayed JSON to the clipboard. */
    onCopy(json: string): void;
}
