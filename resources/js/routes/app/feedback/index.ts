import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\AppFeedbackController::__invoke
* @see app/Http/Controllers/AppFeedbackController.php:16
* @route '/app/feedback'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/app/feedback',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\AppFeedbackController::__invoke
* @see app/Http/Controllers/AppFeedbackController.php:16
* @route '/app/feedback'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AppFeedbackController::__invoke
* @see app/Http/Controllers/AppFeedbackController.php:16
* @route '/app/feedback'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AppFeedbackController::__invoke
* @see app/Http/Controllers/AppFeedbackController.php:16
* @route '/app/feedback'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AppFeedbackController::__invoke
* @see app/Http/Controllers/AppFeedbackController.php:16
* @route '/app/feedback'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

const feedback = {
    store: Object.assign(store, store),
}

export default feedback