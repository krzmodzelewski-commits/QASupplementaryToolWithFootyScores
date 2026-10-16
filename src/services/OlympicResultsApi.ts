import type { CompetitionData } from '../models/CompetitionData';
import { URLS } from '../constants/OlympicResultsUrlsConstant';
import { DataParser } from './DataParser';

export class OlympicResultsApi {
    /** Creates an API service using the supplied parser or a default instance. */
    constructor(private readonly dataParser = new DataParser()) {}

    /** Fetches the available football competition dates. */
    async getCompetitionDates(): Promise<CompetitionData> {
        return this.fetchJson<CompetitionData>(URLS.competitionDates);
    }

    /** Fetches and transforms match summaries for the requested date. */
    async getMatchSummary(date: string): Promise<ReturnType<DataParser['transformSchedules']>> {
        if (!date.trim()) {
            throw new Error('OlympicResultsApi: date must not be empty.');
        }

        const url = this.dataParser.buildMatchSummaryUrl(date);
        const data = await this.fetchJson<Parameters<DataParser['transformSchedules']>[0]>(url);
        return this.dataParser.transformSchedules(data);
    }

    /** Fetches the original match details for the given result identifier. */
    async getMatchDetails(idMatch: string): Promise<unknown> {
        if (!idMatch.trim()) {
            throw new Error('OlympicResultsApi: idMatch must not be empty.');
        }

        const url = URLS.matchDetails.replace('#{idMatch}', encodeURIComponent(idMatch));
        return this.fetchJson(url);
    }

    /** Fetches sport codes and returns the supported football action mappings. */
    async getSportCodes(): Promise<unknown> {
        return this.dataParser.filterFootballActions(await this.fetchJson(URLS.sportCodes));
    }

    /** Fetches JSON and throws an error for unsuccessful HTTP responses. */
    private async fetchJson<T = unknown>(url: string): Promise<T> {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `OlympicResultsApi: HTTP ${response.status} ${response.statusText} (${url})`,
            );
        }

        return response.json();
    }

}