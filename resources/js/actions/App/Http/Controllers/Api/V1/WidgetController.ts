import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../../../wayfinder'
/**
* @see \App\Http\Controllers\Api\V1\WidgetController::__invoke
* @see app/Http/Controllers/Api/V1/WidgetController.php:23
* @route '/api/v1/widget'
*/
const WidgetController = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: WidgetController.url(options),
    method: 'get',
})

WidgetController.definition = {
    methods: ["get","head"],
    url: '/api/v1/widget',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Api\V1\WidgetController::__invoke
* @see app/Http/Controllers/Api/V1/WidgetController.php:23
* @route '/api/v1/widget'
*/
WidgetController.url = (options?: RouteQueryOptions) => {
    return WidgetController.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Api\V1\WidgetController::__invoke
* @see app/Http/Controllers/Api/V1/WidgetController.php:23
* @route '/api/v1/widget'
*/
WidgetController.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: WidgetController.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\Api\V1\WidgetController::__invoke
* @see app/Http/Controllers/Api/V1/WidgetController.php:23
* @route '/api/v1/widget'
*/
WidgetController.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: WidgetController.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\Api\V1\WidgetController::__invoke
* @see app/Http/Controllers/Api/V1/WidgetController.php:23
* @route '/api/v1/widget'
*/
const WidgetControllerForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: WidgetController.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\Api\V1\WidgetController::__invoke
* @see app/Http/Controllers/Api/V1/WidgetController.php:23
* @route '/api/v1/widget'
*/
WidgetControllerForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: WidgetController.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\Api\V1\WidgetController::__invoke
* @see app/Http/Controllers/Api/V1/WidgetController.php:23
* @route '/api/v1/widget'
*/
WidgetControllerForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: WidgetController.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

WidgetController.form = WidgetControllerForm

export default WidgetController