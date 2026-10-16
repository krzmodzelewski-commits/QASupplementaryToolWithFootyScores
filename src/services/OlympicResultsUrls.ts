export const URLS = {
    competitionDates: 'https://stacy.olympics.com/OG2024/data/SCH_DaysByDiscipline~comp=OG2024~disc=FBL~lang=ENG.json',
    matchSummary: 'https://stacy.olympics.com/OG2024/data/SCH_ByDisciplineH2H~comp=OG2024~disc=FBL~lang=ENG~date=',
    matchDetails: 'https://stacy.olympics.com/OG2024/data/RES_ByRSC_H2H~comp=OG2024~disc=FBL~rscResult=#{idMatch}~lang=ENG.json',
    disciplines: 'https://stacy.olympics.com/OG2024/data/GLO_Disciplines~comp=OG2024~lang=ENG.json',
    sportCodes: 'https://stacy.olympics.com/OG2024/data/GLO_SportCodes~comp=OG2024~lang=ENG.json',
    labels: 'https://stacy.olympics.com/OG2024/locales/eng/labels.json'
} as const;
