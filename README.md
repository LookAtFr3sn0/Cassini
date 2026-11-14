# Cassini
A self-hosted listening tracker and music discovery engine.

It speaks the Last.fm API so apps work by just changing the URL.  It can import your full history so you don't lose data.\
Fast, modern and customizable dashboard with top artists, albums and tracks, listening patterns over time and comparisons with friends.

You can use the official hosted instance or run your own.

> ⚠️ Early development\
> Features describe what Cassini is being built to do. Expect breaking changes until v1.0

## Features
### Tracking
* Last.fm and ListenBrainz compatible scrobble endpoints
* Full Last.fm history import, plus CSV import/export
* Per user API tokens

### Stats
* Top artists, albums, and tracks over any period
* Listening activity over time, listening clock, period-over-period trends
* Friends comparisons and group leaderboards
* Shareable recaps

### Discovery
* Pluggable recommendation engines behind a documented API
* Built-in open engine (similar artists, co-listening) that runs locally on any install
* Cassini discovery, the advanced engine available on the hosted instance, with discovery modes from "more like this" to deliberately drifting away from it

## Hosted vs self-hosted
||Self-hosted|Hosted: Free|Hosted: Plus|
|-|-|-|-|
|Scrobbling, import, export|&check;|&check;|&check;|
|Core stats|&check;|&check;|&check;|
|Advanced stats|&check;|Last 12 months|&check;|
|Recommendations|Built-in open engine|Cassini Discovery, weekly|Cassini Discovery, daily / on-demand|
|Discovery modes|Basic|Basic|All|
|Groups & leaderboards|Unlimited|1 group|TBD|
|Recap|&check;|Monthly and yearly|&check;|

## Self-hosting
> Installation instructions will be finalized before the first release

Cassini is designed to run with Docker Compose:
```sh
git clone https://github.com/LookAtFr3sn0/Cassini cassini
cd cassini
cp .env.example .env # Edit .env with your credentials
docker compose up -d
```

### Key configuration
|Variable|Purpose|Default|
|-|-|-|
|SINGLE_USER|Disables public signup for personal instances|`True`|
|LASTFM_API_KEY|Needed for Last.fm history import|None|
|RECOMMENDATIONS_ENABLED|Turns recommendations on or off|`True`|
|RECOMMENDER_URL|Recommendation engine to use.  Empty uses the built-in open engine|None|
|RECOMMENDATIONS_CRON|How often the recommendations are regenerated|`daily`|

## Tech stack
* **Frontend**: TBD
* **Backend**: Node, TypeScript
* **Database**: PostgreSQL
* **Tests**: Vitest
* **Deployment**: Docker

## Contributing
Contributions are welcome.  Please sign off your commits (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/).

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License
Cassini is licensed under the **GNU Affero General Public License v3.0 or later** (`AGPL-3.0-or-later`).  See [LICENSE](LICENSE)