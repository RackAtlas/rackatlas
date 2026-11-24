import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\NetworkController::index
* @see app/Http/Controllers/NetworkController.php:20
* @route '/app/network'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/app/network',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\NetworkController::index
* @see app/Http/Controllers/NetworkController.php:20
* @route '/app/network'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\NetworkController::index
* @see app/Http/Controllers/NetworkController.php:20
* @route '/app/network'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\NetworkController::index
* @see app/Http/Controllers/NetworkController.php:20
* @route '/app/network'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\NetworkController::index
* @see app/Http/Controllers/NetworkController.php:20
* @route '/app/network'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\NetworkController::index
* @see app/Http/Controllers/NetworkController.php:20
* @route '/app/network'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\NetworkController::index
* @see app/Http/Controllers/NetworkController.php:20
* @route '/app/network'
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

const NetworkController = { index }

export default NetworkController