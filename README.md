<img src="https://img.shields.io/badge/Ethos-Network-blue.svg" /> <img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg" /> <img src="https://img.shields.io/badge/License-MIT-yellow.svg" />

## Overview

This repository contains a set of Node.js scripts designed to interact with the Ethos.network API. It fetches data on users from the "Abstract Giga Chads" category (category ID 26), analyzes their activities, ranks them based on interactions like reviews and vouches, and generates JSON outputs for web applications or further processing. The scripts handle data cleaning, duplicate removal, and enrichment for features like invitations, recent activities, new users, and daily rank changes.

## Features
- Fetch and clean user data from Ethos API.
- Analyze and rank users based on reviews, vouches, and other interactions.
- Generate data on available invitations from Giga Chads.
- Track recent activities (vouches and reviews) among users.
- Identify and enrich data on newly added Giga Chads.
- Calculate daily rank changes based on points from activities.

## Scripts Overview
The scripts are numbered sequentially for logical execution order, but they can be run independently if dependencies are met (e.g., some rely on JSON outputs from previous scripts).

- **1-fetch-gigachads.js**: Fetches all users from the "Abstract Giga Chads" category, handles duplicates, recovers missing profile IDs, analyzes data, and saves to `gigachads-data.json`.
 
- **2-analyze-and-rank.js**: Loads data from `gigachads-data.json`, analyzes user activities (reviews, vouches), calculates scores, ranks users, and saves enriched ranking data to `gigachads-ranking.json`.

- **3-invitations-gigachads.js**: Fetches invitation data from Ethos profiles, filters for Giga Chads with available invites, and generates `invitations-data.json` with the top 5 users.

- **4-generate-activities.js**: Fetches recent activities (vouches and reviews) among Giga Chads from the top-ranked users, enriches with timestamps and URLs, and saves to `activities-data.json`.

- **5-generate-new-gigachads.js**: Identifies the most recent Giga Chads added, enriches with creation dates, invited-by info, and time-ago strings, saving to `new-gigachads-data.json`.

- **6-generate-rank-changes.js**: Analyzes recent activities to calculate daily point gains from vouches and reviews, ranks top gainers, and saves to `rank-changes-data.json`.

## Prerequisites
- Node.js (v14+ recommended).
- No external dependencies beyond built-in modules like `fs` and `path`. All scripts use native `fetch` for API calls.

## Installation
1. Clone the repository:

- `git clone https://github.com/guezito-dev/Ethos.git`

- `cd Ethos`


2. No `npm install` is needed since there are no external packages.

## Usage
Run each script individually using Node.js. They output JSON files in the current directory and log progress to the console.

Example: `node 1-fetch-gigachads.js`


- Scripts like `2-analyze-and-rank.js` depend on outputs from previous ones (e.g., `gigachads-data.json`).
- For automation, chain them in a script or use a task runner.
- Debug mode is enabled by default in some scripts for verbose logging; set `DEBUG_MODE = false` to disable.

**Note**: API calls are rate-limited. Scripts include delays (e.g., 200ms between batches) to avoid bans. Use responsibly and respect Ethos.network's terms.

## Output Files
- `gigachads-data.json`: Raw and cleaned user data.
- `gigachads-ranking.json`: Ranked users with stats and avatars.
- `invitations-data.json`: Top Giga Chads with available invites.
- `activities-data.json`: Recent vouches and reviews with enriched details.
- `new-gigachads-data.json`: Latest added users with timestamps and invited-by info.
- `rank-changes-data.json`: Daily top point gainers from activities.

These JSON files are designed for easy integration into web apps (e.g., displaying rankings or activities on a site).

## License
MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments
- Built using the Ethos.network API (v1/v2).
- Data sourced from public endpoints; no authentication required.


