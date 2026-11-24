import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../wayfinder'
/**
* @see \App\Http\Controllers\Admin\ImpersonationController::leave
* @see app/Http/Controllers/Admin/ImpersonationController.php:42
* @route '/app/impersonation/leave'
*/
export const leave = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: leave.url(options),
    method: 'post',
})

leave.definition = {
    methods: ["post"],
    url: '/app/impersonation/leave',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\ImpersonationController::leave
* @see app/Http/Controllers/Admin/ImpersonationController.php:42
* @route '/app/impersonation/leave'
*/
leave.url = (options?: RouteQueryOptions) => {
    return leave.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ImpersonationController::leave
* @see app/Http/Controllers/Admin/ImpersonationController.php:42
* @route '/app/impersonation/leave'
*/
leave.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: leave.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Admin\ImpersonationController::leave
* @see app/Http/Controllers/Admin/ImpersonationController.php:42
* @route '/app/impersonation/leave'
*/
const leaveForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: leave.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Admin\ImpersonationController::leave
* @see app/Http/Controllers/Admin/ImpersonationController.php:42
* @route '/app/impersonation/leave'
*/
leaveForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: leave.url(options),
    method: 'post',
})

leave.form = leaveForm

const impersonation = {
    leave: Object.assign(leave, leave),
}

export default impersonation