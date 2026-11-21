import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\AppFeedbackController::__invoke
* @see app/Http/Controllers/AppFeedbackController.php:16
* @route '/app/feedback'
*/
const AppFeedbackController = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: AppFeedbackController.url(options),
    method: 'post',
})

AppFeedbackController.definition = {
    methods: ["post"],
    url: '/app/feedback',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\AppFeedbackController::__invoke
* @see app/Http/Controllers/AppFeedbackController.php:16
* @route '/app/feedback'
*/
AppFeedbackController.url = (options?: RouteQueryOptions) => {
    return AppFeedbackController.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AppFeedbackController::__invoke
* @see app/Http/Controllers/AppFeedbackController.php:16
* @route '/app/feedback'
*/
AppFeedbackController.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: AppFeedbackController.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AppFeedbackController::__invoke
* @see app/Http/Controllers/AppFeedbackController.php:16
* @route '/app/feedback'
*/
const AppFeedbackControllerForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: AppFeedbackController.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AppFeedbackController::__invoke
* @see app/Http/Controllers/AppFeedbackController.php:16
* @route '/app/feedback'
*/
AppFeedbackControllerForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: AppFeedbackController.url(options),
    method: 'post',
})

AppFeedbackController.form = AppFeedbackControllerForm

export default AppFeedbackController