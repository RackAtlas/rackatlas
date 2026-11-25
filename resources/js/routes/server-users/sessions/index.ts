import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\ServerUserController::end
* @see app/Http/Controllers/ServerUserController.php:239
* @route '/app/server-users/{server}/sessions/end'
*/
export const end = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: end.url(args, options),
    method: 'post',
})

end.definition = {
    methods: ["post"],
    url: '/app/server-users/{server}/sessions/end',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ServerUserController::end
* @see app/Http/Controllers/ServerUserController.php:239
* @route '/app/server-users/{server}/sessions/end'
*/
end.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { server: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { server: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            server: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        server: typeof args.server === 'object'
        ? args.server.id
        : args.server,
    }

    return end.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::end
* @see app/Http/Controllers/ServerUserController.php:239
* @route '/app/server-users/{server}/sessions/end'
*/
end.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: end.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::end
* @see app/Http/Controllers/ServerUserController.php:239
* @route '/app/server-users/{server}/sessions/end'
*/
const endForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: end.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::end
* @see app/Http/Controllers/ServerUserController.php:239
* @route '/app/server-users/{server}/sessions/end'
*/
endForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: end.url(args, options),
    method: 'post',
})

end.form = endForm

const sessions = {
    end: Object.assign(end, end),
}

export default sessions