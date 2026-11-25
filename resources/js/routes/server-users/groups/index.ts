import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:212
* @route '/app/server-users/{server}/groups'
*/
export const store = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/app/server-users/{server}/groups',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:212
* @route '/app/server-users/{server}/groups'
*/
store.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return store.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:212
* @route '/app/server-users/{server}/groups'
*/
store.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:212
* @route '/app/server-users/{server}/groups'
*/
const storeForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:212
* @route '/app/server-users/{server}/groups'
*/
storeForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:226
* @route '/app/server-users/{server}/groups/{group}'
*/
export const destroy = (args: { server: number | { id: number }, group: string | number } | [server: number | { id: number }, group: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/app/server-users/{server}/groups/{group}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:226
* @route '/app/server-users/{server}/groups/{group}'
*/
destroy.url = (args: { server: number | { id: number }, group: string | number } | [server: number | { id: number }, group: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            server: args[0],
            group: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        server: typeof args.server === 'object'
        ? args.server.id
        : args.server,
        group: args.group,
    }

    return destroy.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace('{group}', parsedArgs.group.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:226
* @route '/app/server-users/{server}/groups/{group}'
*/
destroy.delete = (args: { server: number | { id: number }, group: string | number } | [server: number | { id: number }, group: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:226
* @route '/app/server-users/{server}/groups/{group}'
*/
const destroyForm = (args: { server: number | { id: number }, group: string | number } | [server: number | { id: number }, group: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:226
* @route '/app/server-users/{server}/groups/{group}'
*/
destroyForm.delete = (args: { server: number | { id: number }, group: string | number } | [server: number | { id: number }, group: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const groups = {
    store: Object.assign(store, store),
    destroy: Object.assign(destroy, destroy),
}

export default groups