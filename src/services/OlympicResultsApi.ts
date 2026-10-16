import type { CompetitionData } from '../models/CompetitionData';
import { URLS } from './OlympicResultsUrls';
import { DataParser } from './DataParser';

export class OlympicResultsApi {
    constructor(private readonly dataExtractor = new DataParser()) {}

    async getCompetitionDates(): Promise<CompetitionData> {
        return this.fetchJson<CompetitionData>(URLS.competitionDates);
    }

    async getMatchSummary(date: string): Promise<ReturnType<DataParser['transformSchedules']>> {
        if (!date.trim()) {
            throw new Error('OlympicResultsApi: date must not be empty.');
        }

        const url = this.dataExtractor.buildMatchSummaryUrl(date);
        const data = await this.fetchJson<Parameters<DataParser['transformSchedules']>[0]>(url);
        return this.dataExtractor.transformSchedules(data);
    }

    async getMatchDetails(idMatch: string): Promise<unknown> {
        if (!idMatch.trim()) {
            throw new Error('OlympicResultsApi: idMatch must not be empty.');
        }

        const url = URLS.matchDetails.replace('#{idMatch}', encodeURIComponent(idMatch));
        return this.fetchJson(url);
    }

    async getDisciplines(): Promise<unknown> {
        return this.fetchJson(URLS.disciplines);
    }

    async getSportCodes(): Promise<unknown> {
        return this.fetchJson(URLS.sportCodes);
    }

    async getLabels(): Promise<unknown> {
        return this.fetchJson(URLS.labels);
    }

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