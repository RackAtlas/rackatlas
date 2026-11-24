import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../../wayfinder'
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

/**
* @see \App\Http\Controllers\Admin\ImpersonationController::start
* @see app/Http/Controllers/Admin/ImpersonationController.php:21
* @route '/app/admin/users/{user}/impersonate'
*/
export const start = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: start.url(args, options),
    method: 'post',
})

start.definition = {
    methods: ["post"],
    url: '/app/admin/users/{user}/impersonate',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Admin\ImpersonationController::start
* @see app/Http/Controllers/Admin/ImpersonationController.php:21
* @route '/app/admin/users/{user}/impersonate'
*/
start.url = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { user: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { user: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            user: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        user: typeof args.user === 'object'
        ? args.user.id
        : args.user,
    }

    return start.definition.url
            .replace('{user}', parsedArgs.user.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Admin\ImpersonationController::start
* @see app/Http/Controllers/Admin/ImpersonationController.php:21
* @route '/app/admin/users/{user}/impersonate'
*/
start.post = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: start.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Admin\ImpersonationController::start
* @see app/Http/Controllers/Admin/ImpersonationController.php:21
* @route '/app/admin/users/{user}/impersonate'
*/
const startForm = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: start.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Admin\ImpersonationController::start
* @see app/Http/Controllers/Admin/ImpersonationController.php:21
* @route '/app/admin/users/{user}/impersonate'
*/
startForm.post = (args: { user: number | { id: number } } | [user: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: start.url(args, options),
    method: 'post',
})

start.form = startForm

const ImpersonationController = { leave, start }

export default ImpersonationController