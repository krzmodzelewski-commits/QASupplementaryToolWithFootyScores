# Olympic Football Results

A web application for browsing football schedules and results from the Paris 2024 Olympic Games.

## Getting started

Use Node.js 22.12 or newer and npm. From the project directory, run:

```bash
npm install
npm run dev
```

Open the local address printed in the terminal (normally `http://127.0.0.1:5173`). The welcome page opens the matches dashboard after three seconds. Clicking the welcome page opens it immediately.

The dashboard is also available directly at `/matches-dashboard.html`.

To create and serve a production build:

```bash
npm run build
npm run preview
```

## Using the dashboard

The first available day is selected automatically. Click another date to see its matches, or choose **All days** to see matches grouped under date headings.

The table shows the match time, event and participants, result, location, and available actions. Times are displayed in **UTC**, not your computer's local time.

Click a column heading to sort matches in ascending or descending order. Click **Filters** to choose **All events**, **Men**, or **Women**, then click **Apply**. The selection remains active when you change dates.

Each match offers these detail views:

| Action | What it shows |
| --- | --- |
| Display details (graphical format) | Starting players, substitutes, positions, goal information, formation, and coaches for both teams. |
| Display details (JSON result format) | A simplified JSON representation prepared by the application's parser. |
| Display details (original JSON format) | The original JSON response from the results API, before transformation. |
| Download JSON result content | A file containing the simplified JSON, without opening the preview first. |

Details appear below the match. Clicking the active display button again hides them. Clicking the match row opens or closes the simplified JSON view.

The simplified JSON preview also provides download and clipboard buttons. Downloaded files are named after the two countries and the match date, for example `France-Spain-2024-08-09.json`. Copying requires browser clipboard permission and a secure context, such as HTTPS or localhost.

### Loading, empty, and error feedback

Status messages distinguish loading, empty results, errors, warnings, and completed actions using text and warm pastel colors. Status updates are announced to assistive technology, and loading regions expose their busy state.

The initial schedule waits for all days' matches. Filters can be applied while loading without showing a misleading empty result. If loading fails, **Retry** reloads the schedule; retry is available only after the previous batch finishes. No competition days, no matches for a day, and no matches for the selected filters each have explicit empty messages.

Details display a loading message and an inline **Retry** on failure. Empty or invalid detail responses are reported as unavailable instead of being exported as an apparently successful empty match. A missing match identifier explains why details and downloads are unavailable. Downloads and clipboard actions show progress and completion or actionable error feedback; their buttons prevent repeated requests while pending. A download confirmation means the browser was asked to download the file, not that it was saved.

Football action labels load independently. A nonblocking notice explains that early JSON results may lack goal types; if labels fail to load, a warning remains while matches and details remain usable.

## How data is retrieved

The browser uses `OlympicResultsApi` to fetch JSON directly from:

`https://stacy.olympics.com/OG2024/`

Endpoint addresses are defined in `src/constants/OlympicResultsUrlsConstant.ts`. Requests use the Paris 2024 competition (`OG2024`), football discipline (`FBL`), and English language (`ENG`).

| Data | Endpoint under the base address |
| --- | --- |
| Available days | `data/SCH_DaysByDiscipline~comp=OG2024~disc=FBL~lang=ENG.json` |
| Matches for a day | `data/SCH_ByDisciplineH2H~comp=OG2024~disc=FBL~lang=ENG~date={date}.json` |
| Details of a match | `data/RES_ByRSC_H2H~comp=OG2024~disc=FBL~rscResult={resultRSC}~lang=ENG.json` |
| Football action codes | `data/GLO_SportCodes~comp=OG2024~lang=ENG.json` |

Dates and result identifiers are URL-encoded before being added to requests. Other addresses for disciplines and labels exist in the constants file but are not requested by the current dashboard.

### Request sequence and endpoint ordering

There is no fixed list of match endpoints hard-coded for individual dates or matches. The application discovers them from earlier responses:

1. When the dashboard opens, it requests the available competition days and, independently, the sport codes.
2. It reads `competition_schedule[].date` and removes empty date values.
3. It requests a daily match summary for every returned date. These requests run in parallel.
4. It waits for all daily summaries before displaying the date list and selecting its first day.
5. When you open details or download a match, it uses that match's `event.resultRSC` to request its details.

The date list preserves the order supplied by the days endpoint; dates are not independently sorted or deduplicated. Parallel requests may finish in any order, but the displayed dates retain the original response order.

The original detail response and its transformed version are reused for the same rendered match row. Switching detail formats therefore does not normally send another request. Changing dates, filters, or sorting rebuilds the rows, so reopening details afterward may fetch them again.

## How data is parsed

`DataParser`, in `src/services/DataParser.ts`, converts API responses into the values displayed by the dashboard.

### Daily schedules

For each schedule entry, the parser extracts:

| Displayed data | Source |
| --- | --- |
| Time and default ordering | `startDate` and `order` |
| Event description and details identifier | `eventUnit.description` and `eventUnit.resultRSC` |
| Participants | `start[].participant`, falling back to `start[].startParticipant` |
| Country name and flag code | The participant's `organisation.description` and `organisation.code` |
| Result | Home and away scores from the result period whose `p_code` is `TOT` |
| Location | `location.longDescription` |

Entries named **Women's Victory Ceremony** or **Men's Victory Ceremony** are excluded. Country flags are local images from `resources/images/flags`, matched by organisation code.

### Match details

The parser reads the `result` object, falling back to `results`. It identifies the home and away teams through their `HOME_AWAY` event entries, then builds the score, venue, lineups, and goal information.

Players with a `STARTER` entry set to `Y` belong to the starting lineup. Other listed players appear under **Substitutes**. The graphical view expands `GK`, `DF`, `MF`, and `FW` to full English position names.

Goal information comes from every `actions` array in `playByPlay`. Only actions whose result is `GOAL` are included. The parser reads the first competitor's athlete list, uses the `SCR` and `ASSIST` roles, and matches athlete codes against both team rosters. The scorer's country is taken from the team roster, rather than inferred from the player's name.

Goal minutes are numeric: `45' +2` becomes `47`, and `68'` becomes `68`. An absent assist is omitted from the simplified JSON.

Only the following football action codes are retained:

| Code | Simplified value |
| --- | --- |
| PEN | `penalty` |
| CRN | `corner` |
| SHOT | `open_play` |
| FRD | `free-kick` |

## How match ordering works

Matches remain grouped by their schedule day, including in **All days**. Sorting changes the order inside each group, not the order of the day groups.

By default, matches are ordered by `timeAndOrder.startDate` ascending, then by the numeric value of `timeAndOrder.order`.

| Selected column | Comparison |
| --- | --- |
| Time | Start timestamp, followed by numeric schedule order |
| Event | Event description followed by participant names, using English text comparison |
| Result | Numeric home score, followed by numeric away score |
| Location | Location description, using English text comparison |

When values in another column are equal, start time and schedule order break the tie. Descending sorting reverses the comparison, including the tie-breaker. Text comparison treats embedded numbers numerically.

## Missing or inconsistent data: assumptions and limitations

The application expects the API's documented-by-usage structure. It does not perform full runtime validation of every JSON field.

| Situation | Current behavior or assumption |
| --- | --- |
| Missing competition schedule or daily schedules | Treated as an empty list. |
| Empty competition date | Removed before building daily endpoints. Non-empty dates are expected to be valid date strings. |
| Missing match time, event description, position, or location | Usually displayed as **Not available**. |
| No `TOT` score or missing score | Stored as `null` and displayed as `-`. A score of zero remains `0`. |
| Missing start time or numeric schedule order | Sorts after known values in ascending time order; reversing the order also reverses this placement. |
| Invalid timestamp or nonnumeric order/score used for sorting | May raise an error; these values are not silently corrected. |
| Timestamp with an explicit offset | Converted to UTC for display and comparison. |
| Timestamp without an offset | Assumed to be UTC, not the browser's local time. |
| Date grouping | Uses the day returned by the schedule endpoint, not a new day calculated from the UTC display time. |
| Missing participant organisation or country flag | Country information may be unavailable; a missing flag file is omitted and logged in the browser console. |
| Missing starter marker | The player is treated as a substitute. No formation or starting lineup is guessed. |
| Missing lineup, formation, or coaches | An empty list or **Not available** message is shown. |
| Missing scorer or assistant in the rosters | The scorer name can be `null`; an unresolved assist is omitted. |
| Missing goal minute | Stored as `null`. An invalid non-empty minute raises an error. |
| Unknown or not-yet-loaded action code | Goal type is an empty string. Sport codes load independently, so early detail requests may lack action labels. |
| Missing details identifier (`resultRSC`) | Details cannot be fetched; an error message is shown. |
| Men/Women filtering | Uses the English words in the event description. Events without a matching word are excluded when that filter is active. |

Competition name and season in the simplified details are currently fixed to **Olympic Games** and **2024**.

If any daily summary request fails, the initial date-and-match loading reports an error rather than presenting the successfully fetched days as a complete schedule. Use **Retry** above the competition days to load the schedule again. A failed detail request shows an inline **Retry** in its panel and can also be retried by closing and reopening it.

Internet access and access to the external Olympics endpoints are required. The provider may reject requests with HTTP 403 or restrict cross-origin browser requests. The application reports these failures; it does not bypass the provider's access restrictions or supply invented results.