# Observability

## Application signals

- Structured JSON logs with request, job, source, and review correlation IDs.
- Error capture, traces for external calls and database queries, and redacted request context.
- API and page latency, error rate, cache hit ratio, and search result count.

## Data-operation signals

- Pipeline success/failure by source and adapter version.
- Fetch age, publication lag, queue depth, retries, and dead letters.
- Percentage of material facts with evidence; freshness SLA; correction rate.
- Review-queue age and reviewer outcomes.
- Alert delivery, open, click, bounce, and suppression metrics.

Alerting should distinguish service incidents from data-quality degradation. Logs must not include contribution payloads, tokens, raw documents, or unnecessary personal data.
