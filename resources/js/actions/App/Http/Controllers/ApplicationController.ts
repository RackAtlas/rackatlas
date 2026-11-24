import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\ApplicationController::index
* @see app/Http/Controllers/ApplicationController.php:23
* @route '/app/applications'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/app/applications',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ApplicationController::index
* @see app/Http/Controllers/ApplicationController.php:23
* @route '/app/applications'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ApplicationController::index
* @see app/Http/Controllers/ApplicationController.php:23
* @route '/app/applications'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ApplicationController::index
* @see app/Http/Controllers/ApplicationController.php:23
* @route '/app/applications'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ApplicationController::index
* @see app/Http/Controllers/ApplicationController.php:23
* @route '/app/applications'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ApplicationController::index
* @see app/Http/Controllers/ApplicationController.php:23
* @route '/app/applications'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ApplicationController::index
* @see app/Http/Controllers/ApplicationController.php:23
* @route '/app/applications'
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
* @see \App\Http\Controllers\ApplicationController::status
* @see app/Http/Controllers/ApplicationController.php:88
* @route '/app/applications/{service}/status'
*/
export const status = (args: { service: number | { id: number } } | [service: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: status.url(args, options),
    method: 'post',
})

status.definition = {
    methods: ["post"],
    url: '/app/applications/{service}/status',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ApplicationController::status
* @see app/Http/Controllers/ApplicationController.php:88
* @route '/app/applications/{service}/status'
*/
status.url = (args: { service: number | { id: number } } | [service: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { service: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { service: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            service: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        service: typeof args.service === 'object'
        ? args.service.id
        : args.service,
    }

    return status.definition.url
            .replace('{service}', parsedArgs.service.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ApplicationController::status
* @see app/Http/Controllers/ApplicationController.php:88
* @route '/app/applications/{service}/status'
*/
status.post = (args: { service: number | { id: number } } | [service: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: status.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ApplicationController::status
* @see app/Http/Controllers/ApplicationController.php:88
* @route '/app/applications/{service}/status'
*/
const statusForm = (args: { service: number | { id: number } } | [service: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: status.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ApplicationController::status
* @see app/Http/Controllers/ApplicationController.php:88
* @route '/app/applications/{service}/status'
*/
statusForm.post = (args: { service: number | { id: number } } | [service: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: status.url(args, options),
    method: 'post',
})

status.form = statusForm

/**
* @see \App\Http\Controllers\ApplicationController::journal
* @see app/Http/Controllers/ApplicationController.php:96
* @route '/app/applications/{service}/journal'
*/
export const journal = (args: { service: number | { id: number } } | [service: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: journal.url(args, options),
    method: 'post',
})

journal.definition = {
    methods: ["post"],
    url: '/app/applications/{service}/journal',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ApplicationController::journal
* @see app/Http/Controllers/ApplicationController.php:96
* @route '/app/applications/{service}/journal'
*/
journal.url = (args: { service: number | { id: number } } | [service: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { service: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { service: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            service: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        service: typeof args.service === 'object'
        ? args.service.id
        : args.service,
    }

    return journal.definition.url
            .replace('{service}', parsedArgs.service.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ApplicationController::journal
* @see app/Http/Controllers/ApplicationController.php:96
* @route '/app/applications/{service}/journal'
*/
journal.post = (args: { service: number | { id: number } } | [service: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: journal.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ApplicationController::journal
* @see app/Http/Controllers/ApplicationController.php:96
* @route '/app/applications/{service}/journal'
*/
const journalForm = (args: { service: number | { id: number } } | [service: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: journal.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ApplicationController::journal
* @see app/Http/Controllers/ApplicationController.php:96
* @route '/app/applications/{service}/journal'
*/
journalForm.post = (args: { service: number | { id: number } } | [service: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: journal.url(args, options),
    method: 'post',
})

journal.form = journalForm

/**
* @see \App\Http\Controllers\ApplicationController::act
* @see app/Http/Controllers/ApplicationController.php:68
* @route '/app/applications/{service}/{action}'
*/
export const act = (args: { service: number | { id: number }, action: string | number } | [service: number | { id: number }, action: string | number ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: act.url(args, options),
    method: 'post',
})

act.definition = {
    methods: ["post"],
    url: '/app/applications/{service}/{action}',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ApplicationController::act
* @see app/Http/Controllers/ApplicationController.php:68
* @route '/app/applications/{service}/{action}'
*/
act.url = (args: { service: number | { id: number }, action: string | number } | [service: number | { id: number }, action: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            service: args[0],
            action: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        service: typeof args.service === 'object'
        ? args.service.id
        : args.service,
        action: args.action,
    }

    return act.definition.url
            .replace('{service}', parsedArgs.service.toString())
            .replace('{action}', parsedArgs.action.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ApplicationController::act
* @see app/Http/Controllers/ApplicationController.php:68
* @route '/app/applications/{service}/{action}'
*/
act.post = (args: { service: number | { id: number }, action: string | number } | [service: number | { id: number }, action: string | number ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: act.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ApplicationController::act
* @see app/Http/Controllers/ApplicationController.php:68
* @route '/app/applications/{service}/{action}'
*/
const actForm = (args: { service: number | { id: number }, action: string | number } | [service: number | { id: number }, action: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: act.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ApplicationController::act
* @see app/Http/Controllers/ApplicationController.php:68
* @route '/app/applications/{service}/{action}'
*/
actForm.post = (args: { service: number | { id: number }, action: string | number } | [service: number | { id: number }, action: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: act.url(args, options),
    method: 'post',
})

act.form = actForm

const ApplicationController = { index, status, journal, act }

export default ApplicationController