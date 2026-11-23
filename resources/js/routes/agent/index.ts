import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../wayfinder'
/**
* @see \App\Http\Controllers\Api\AgentIngestController::__invoke
* @see app/Http/Controllers/Api/AgentIngestController.php:22
* @route '/api/agent/ingest'
*/
export const ingest = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: ingest.url(options),
    method: 'post',
})

ingest.definition = {
    methods: ["post"],
    url: '/api/agent/ingest',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Api\AgentIngestController::__invoke
* @see app/Http/Controllers/Api/AgentIngestController.php:22
* @route '/api/agent/ingest'
*/
ingest.url = (options?: RouteQueryOptions) => {
    return ingest.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Api\AgentIngestController::__invoke
* @see app/Http/Controllers/Api/AgentIngestController.php:22
* @route '/api/agent/ingest'
*/
ingest.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: ingest.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Api\AgentIngestController::__invoke
* @see app/Http/Controllers/Api/AgentIngestController.php:22
* @route '/api/agent/ingest'
*/
const ingestForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: ingest.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Api\AgentIngestController::__invoke
* @see app/Http/Controllers/Api/AgentIngestController.php:22
* @route '/api/agent/ingest'
*/
ingestForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: ingest.url(options),
    method: 'post',
})

ingest.form = ingestForm

/**
* @see \App\Http\Controllers\Api\AgentJournalController::__invoke
* @see app/Http/Controllers/Api/AgentJournalController.php:17
* @route '/api/agent/journal'
*/
export const journal = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: journal.url(options),
    method: 'post',
})

journal.definition = {
    methods: ["post"],
    url: '/api/agent/journal',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Api\AgentJournalController::__invoke
* @see app/Http/Controllers/Api/AgentJournalController.php:17
* @route '/api/agent/journal'
*/
journal.url = (options?: RouteQueryOptions) => {
    return journal.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Api\AgentJournalController::__invoke
* @see app/Http/Controllers/Api/AgentJournalController.php:17
* @route '/api/agent/journal'
*/
journal.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: journal.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Api\AgentJournalController::__invoke
* @see app/Http/Controllers/Api/AgentJournalController.php:17
* @route '/api/agent/journal'
*/
const journalForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: journal.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Api\AgentJournalController::__invoke
* @see app/Http/Controllers/Api/AgentJournalController.php:17
* @route '/api/agent/journal'
*/
journalForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: journal.url(options),
    method: 'post',
})

journal.form = journalForm

/**
* @see \App\Http\Controllers\Api\AgentDockerLogsController::__invoke
* @see app/Http/Controllers/Api/AgentDockerLogsController.php:17
* @route '/api/agent/docker-logs'
*/
export const dockerLogs = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: dockerLogs.url(options),
    method: 'post',
})

dockerLogs.definition = {
    methods: ["post"],
    url: '/api/agent/docker-logs',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Api\AgentDockerLogsController::__invoke
* @see app/Http/Controllers/Api/AgentDockerLogsController.php:17
* @route '/api/agent/docker-logs'
*/
dockerLogs.url = (options?: RouteQueryOptions) => {
    return dockerLogs.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Api\AgentDockerLogsController::__invoke
* @see app/Http/Controllers/Api/AgentDockerLogsController.php:17
* @route '/api/agent/docker-logs'
*/
dockerLogs.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: dockerLogs.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Api\AgentDockerLogsController::__invoke
* @see app/Http/Controllers/Api/AgentDockerLogsController.php:17
* @route '/api/agent/docker-logs'
*/
const dockerLogsForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: dockerLogs.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Api\AgentDockerLogsController::__invoke
* @see app/Http/Controllers/Api/AgentDockerLogsController.php:17
* @route '/api/agent/docker-logs'
*/
dockerLogsForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: dockerLogs.url(options),
    method: 'post',
})

dockerLogs.form = dockerLogsForm

const agent = {
    ingest: Object.assign(ingest, ingest),
    journal: Object.assign(journal, journal),
    dockerLogs: Object.assign(dockerLogs, dockerLogs),
}

export default agent