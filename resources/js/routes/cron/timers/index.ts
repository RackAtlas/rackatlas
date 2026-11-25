import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\CronController::act
* @see app/Http/Controllers/CronController.php:143
* @route '/app/cron/{server}/timers/{action}'
*/
export const act = (args: { server: number | { id: number }, action: string | number } | [server: number | { id: number }, action: string | number ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: act.url(args, options),
    method: 'post',
})

act.definition = {
    methods: ["post"],
    url: '/app/cron/{server}/timers/{action}',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CronController::act
* @see app/Http/Controllers/CronController.php:143
* @route '/app/cron/{server}/timers/{action}'
*/
act.url = (args: { server: number | { id: number }, action: string | number } | [server: number | { id: number }, action: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            server: args[0],
            action: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        server: typeof args.server === 'object'
        ? args.server.id
        : args.server,
        action: args.action,
    }

    return act.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace('{action}', parsedArgs.action.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CronController::act
* @see app/Http/Controllers/CronController.php:143
* @route '/app/cron/{server}/timers/{action}'
*/
act.post = (args: { server: number | { id: number }, action: string | number } | [server: number | { id: number }, action: string | number ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: act.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::act
* @see app/Http/Controllers/CronController.php:143
* @route '/app/cron/{server}/timers/{action}'
*/
const actForm = (args: { server: number | { id: number }, action: string | number } | [server: number | { id: number }, action: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: act.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::act
* @see app/Http/Controllers/CronController.php:143
* @route '/app/cron/{server}/timers/{action}'
*/
actForm.post = (args: { server: number | { id: number }, action: string | number } | [server: number | { id: number }, action: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: act.url(args, options),
    method: 'post',
})

act.form = actForm

const timers = {
    act: Object.assign(act, act),
}

export default timers