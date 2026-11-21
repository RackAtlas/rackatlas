import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../wayfinder'
/**
* @see \App\Http\Controllers\Settings\WidgetTokenController::__invoke
* @see app/Http/Controllers/Settings/WidgetTokenController.php:23
* @route '/app/widget-token'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/app/widget-token',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Settings\WidgetTokenController::__invoke
* @see app/Http/Controllers/Settings/WidgetTokenController.php:23
* @route '/app/widget-token'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Settings\WidgetTokenController::__invoke
* @see app/Http/Controllers/Settings/WidgetTokenController.php:23
* @route '/app/widget-token'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Settings\WidgetTokenController::__invoke
* @see app/Http/Controllers/Settings/WidgetTokenController.php:23
* @route '/app/widget-token'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Settings\WidgetTokenController::__invoke
* @see app/Http/Controllers/Settings/WidgetTokenController.php:23
* @route '/app/widget-token'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

const widgetToken = {
    store: Object.assign(store, store),
}

export default widgetToken