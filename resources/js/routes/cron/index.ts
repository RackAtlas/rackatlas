import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
import jobs from './jobs'
import timers from './timers'
/**
* @see \App\Http\Controllers\CronController::index
* @see app/Http/Controllers/CronController.php:22
* @route '/app/cron'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/app/cron',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\CronController::index
* @see app/Http/Controllers/CronController.php:22
* @route '/app/cron'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\CronController::index
* @see app/Http/Controllers/CronController.php:22
* @route '/app/cron'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\CronController::index
* @see app/Http/Controllers/CronController.php:22
* @route '/app/cron'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\CronController::index
* @see app/Http/Controllers/CronController.php:22
* @route '/app/cron'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\CronController::index
* @see app/Http/Controllers/CronController.php:22
* @route '/app/cron'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\CronController::index
* @see app/Http/Controllers/CronController.php:22
* @route '/app/cron'
*/
indexForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

index.form = indexForm

/**
* @see \App\Http\Controllers\CronController::preview
* @see app/Http/Controllers/CronController.php:44
* @route '/app/cron/preview'
*/
export const preview = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: preview.url(options),
    method: 'post',
})

preview.definition = {
    methods: ["post"],
    url: '/app/cron/preview',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CronController::preview
* @see app/Http/Controllers/CronController.php:44
* @route '/app/cron/preview'
*/
preview.url = (options?: RouteQueryOptions) => {
    return preview.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\CronController::preview
* @see app/Http/Controllers/CronController.php:44
* @route '/app/cron/preview'
*/
preview.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: preview.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::preview
* @see app/Http/Controllers/CronController.php:44
* @route '/app/cron/preview'
*/
const previewForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: preview.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::preview
* @see app/Http/Controllers/CronController.php:44
* @route '/app/cron/preview'
*/
previewForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: preview.url(options),
    method: 'post',
})

preview.form = previewForm

/**
* @see \App\Http\Controllers\CronController::show
* @see app/Http/Controllers/CronController.php:34
* @route '/app/cron/{server}'
*/
export const show = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: show.url(args, options),
    method: 'post',
})

show.definition = {
    methods: ["post"],
    url: '/app/cron/{server}',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CronController::show
* @see app/Http/Controllers/CronController.php:34
* @route '/app/cron/{server}'
*/
show.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { server: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { server: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            server: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        server: typeof args.server === 'object'
        ? args.server.id
        : args.server,
    }

    return show.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CronController::show
* @see app/Http/Controllers/CronController.php:34
* @route '/app/cron/{server}'
*/
show.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: show.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::show
* @see app/Http/Controllers/CronController.php:34
* @route '/app/cron/{server}'
*/
const showForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: show.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::show
* @see app/Http/Controllers/CronController.php:34
* @route '/app/cron/{server}'
*/
showForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: show.url(args, options),
    method: 'post',
})

show.form = showForm

/**
* @see \App\Http\Controllers\CronController::journal
* @see app/Http/Controllers/CronController.php:160
* @route '/app/cron/{server}/journal'
*/
export const journal = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: journal.url(args, options),
    method: 'post',
})

journal.definition = {
    methods: ["post"],
    url: '/app/cron/{server}/journal',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CronController::journal
* @see app/Http/Controllers/CronController.php:160
* @route '/app/cron/{server}/journal'
*/
journal.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { server: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { server: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            server: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        server: typeof args.server === 'object'
        ? args.server.id
        : args.server,
    }

    return journal.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CronController::journal
* @see app/Http/Controllers/CronController.php:160
* @route '/app/cron/{server}/journal'
*/
journal.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: journal.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::journal
* @see app/Http/Controllers/CronController.php:160
* @route '/app/cron/{server}/journal'
*/
const journalForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: journal.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::journal
* @see app/Http/Controllers/CronController.php:160
* @route '/app/cron/{server}/journal'
*/
journalForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: journal.url(args, options),
    method: 'post',
})

journal.form = journalForm

const cron = {
    index: Object.assign(index, index),
    preview: Object.assign(preview, preview),
    show: Object.assign(show, show),
    journal: Object.assign(journal, journal),
    jobs: Object.assign(jobs, jobs),
    timers: Object.assign(timers, timers),
}

export default cron