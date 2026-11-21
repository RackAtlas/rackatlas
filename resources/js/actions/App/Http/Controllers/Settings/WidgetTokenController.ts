import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../../wayfinder'
/**
* @see \App\Http\Controllers\Settings\WidgetTokenController::__invoke
* @see app/Http/Controllers/Settings/WidgetTokenController.php:23
* @route '/app/widget-token'
*/
const WidgetTokenController = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: WidgetTokenController.url(options),
    method: 'post',
})

WidgetTokenController.definition = {
    methods: ["post"],
    url: '/app/widget-token',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Settings\WidgetTokenController::__invoke
* @see app/Http/Controllers/Settings/WidgetTokenController.php:23
* @route '/app/widget-token'
*/
WidgetTokenController.url = (options?: RouteQueryOptions) => {
    return WidgetTokenController.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Settings\WidgetTokenController::__invoke
* @see app/Http/Controllers/Settings/WidgetTokenController.php:23
* @route '/app/widget-token'
*/
WidgetTokenController.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: WidgetTokenController.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Settings\WidgetTokenController::__invoke
* @see app/Http/Controllers/Settings/WidgetTokenController.php:23
* @route '/app/widget-token'
*/
const WidgetTokenControllerForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: WidgetTokenController.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Settings\WidgetTokenController::__invoke
* @see app/Http/Controllers/Settings/WidgetTokenController.php:23
* @route '/app/widget-token'
*/
WidgetTokenControllerForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: WidgetTokenController.url(options),
    method: 'post',
})

WidgetTokenController.form = WidgetTokenControllerForm

export default WidgetTokenController