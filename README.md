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
|API rates|Unlimited¹|Low|High|
|Discovery modes|Basic|Basic|All|
|Groups & leaderboards|Unlimited|1 group|TBD|
|Recap|&check;|Monthly and yearly|&check;|

¹ Self-hosted instances have no limit on recommendation API requests, other than the ones the owner sets.

## Recommendations API
> Draft, will change before v1.0

Authenticated with a per user API token
`(Authorization: Bearer <token>)`

|Request|Returns|
|-|-|
|`GET /api/v1/recommendations/sources`|The engines this instance offers, with the discovery modes each one supports|
|`GET /api/v1/recommendations?source=builtin&mode=similar&limit=50`|Recommended tracks from the chosen engine. `source` falls back to the instance default|

Each track has `artist`, `title`, `album`, `mbid` when known, a `score` from 0 to 1, and a short `reason`.  An unknown `source` or a `mode` the engine doesn't support is a 400.

## Self-hosting
> Installation instructions will be finalized before the first release

Cassini is designed to run with Docker Compose:
```sh
git clone https://github.com/cassini-fm/Cassini cassini
cd cassini
cp .env.example .env # Edit .env with your credentials
docker compose up -d
```

### Key configuration
|Variable|Purpose|Default|
|-|-|-|
|LASTFM_API_KEY|Needed for Last.fm history import|None|
|RECOMMENDERS|Extra recommendations engines as `name=url`, comma separated.  The built-in open engine is always available as `builtin`|None|
|RECOMMENDATIONS_CRON|How often the recommendations are regenerated|`daily`|
|RECOMMENDATIONS_ENABLED|Turns recommendations on or off|`True`|
|SINGLE_USER|Disables public signup for personal instances|`True`|

## Tech stack
* **Frontend**: TBD
* **Backend**: Node, TypeScript, Fastify
* **Database**: PostgreSQL
* **Tests**: Vitest
* **Deployment**: Docker

## Contributing
Contributions are welcome.  Please sign off your commits (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/).

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License
Cassini is licensed under the **GNU Affero General Public License v3.0 or later** (`AGPL-3.0-or-later`).  See [LICENSE](LICENSE)