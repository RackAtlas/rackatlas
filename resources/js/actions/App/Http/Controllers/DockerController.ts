import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\DockerController::index
* @see app/Http/Controllers/DockerController.php:21
* @route '/app/docker'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/app/docker',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\DockerController::index
* @see app/Http/Controllers/DockerController.php:21
* @route '/app/docker'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\DockerController::index
* @see app/Http/Controllers/DockerController.php:21
* @route '/app/docker'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\DockerController::index
* @see app/Http/Controllers/DockerController.php:21
* @route '/app/docker'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\DockerController::index
* @see app/Http/Controllers/DockerController.php:21
* @route '/app/docker'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\DockerController::index
* @see app/Http/Controllers/DockerController.php:21
* @route '/app/docker'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\DockerController::index
* @see app/Http/Controllers/DockerController.php:21
* @route '/app/docker'
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
* @see \App\Http\Controllers\DockerController::logs
* @see app/Http/Controllers/DockerController.php:95
* @route '/app/docker/containers/{container}/logs'
*/
export const logs = (args: { container: string | number | { id: string | number } } | [container: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: logs.url(args, options),
    method: 'post',
})

logs.definition = {
    methods: ["post"],
    url: '/app/docker/containers/{container}/logs',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\DockerController::logs
* @see app/Http/Controllers/DockerController.php:95
* @route '/app/docker/containers/{container}/logs'
*/
logs.url = (args: { container: string | number | { id: string | number } } | [container: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { container: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { container: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            container: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        container: typeof args.container === 'object'
        ? args.container.id
        : args.container,
    }

    return logs.definition.url
            .replace('{container}', parsedArgs.container.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\DockerController::logs
* @see app/Http/Controllers/DockerController.php:95
* @route '/app/docker/containers/{container}/logs'
*/
logs.post = (args: { container: string | number | { id: string | number } } | [container: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: logs.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\DockerController::logs
* @see app/Http/Controllers/DockerController.php:95
* @route '/app/docker/containers/{container}/logs'
*/
const logsForm = (args: { container: string | number | { id: string | number } } | [container: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: logs.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\DockerController::logs
* @see app/Http/Controllers/DockerController.php:95
* @route '/app/docker/containers/{container}/logs'
*/
logsForm.post = (args: { container: string | number | { id: string | number } } | [container: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: logs.url(args, options),
    method: 'post',
})

logs.form = logsForm

/**
* @see \App\Http\Controllers\DockerController::act
* @see app/Http/Controllers/DockerController.php:68
* @route '/app/docker/containers/{container}/{action}'
*/
export const act = (args: { container: string | number | { id: string | number }, action: string | number } | [container: string | number | { id: string | number }, action: string | number ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: act.url(args, options),
    method: 'post',
})

act.definition = {
    methods: ["post"],
    url: '/app/docker/containers/{container}/{action}',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\DockerController::act
* @see app/Http/Controllers/DockerController.php:68
* @route '/app/docker/containers/{container}/{action}'
*/
act.url = (args: { container: string | number | { id: string | number }, action: string | number } | [container: string | number | { id: string | number }, action: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            container: args[0],
            action: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        container: typeof args.container === 'object'
        ? args.container.id
        : args.container,
        action: args.action,
    }

    return act.definition.url
            .replace('{container}', parsedArgs.container.toString())
            .replace('{action}', parsedArgs.action.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\DockerController::act
* @see app/Http/Controllers/DockerController.php:68
* @route '/app/docker/containers/{container}/{action}'
*/
act.post = (args: { container: string | number | { id: string | number }, action: string | number } | [container: string | number | { id: string | number }, action: string | number ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: act.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\DockerController::act
* @see app/Http/Controllers/DockerController.php:68
* @route '/app/docker/containers/{container}/{action}'
*/
const actForm = (args: { container: string | number | { id: string | number }, action: string | number } | [container: string | number | { id: string | number }, action: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: act.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\DockerController::act
* @see app/Http/Controllers/DockerController.php:68
* @route '/app/docker/containers/{container}/{action}'
*/
actForm.post = (args: { container: string | number | { id: string | number }, action: string | number } | [container: string | number | { id: string | number }, action: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: act.url(args, options),
    method: 'post',
})

act.form = actForm

const DockerController = { index, logs, act }

export default DockerController