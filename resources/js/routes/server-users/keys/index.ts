import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:177
* @route '/app/server-users/{server}/users/{user}/keys'
*/
export const store = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/app/server-users/{server}/users/{user}/keys',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:177
* @route '/app/server-users/{server}/users/{user}/keys'
*/
store.url = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            server: args[0],
            user: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        server: typeof args.server === 'object'
        ? args.server.id
        : args.server,
        user: args.user,
    }

    return store.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace('{user}', parsedArgs.user.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:177
* @route '/app/server-users/{server}/users/{user}/keys'
*/
store.post = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:177
* @route '/app/server-users/{server}/users/{user}/keys'
*/
const storeForm = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:177
* @route '/app/server-users/{server}/users/{user}/keys'
*/
storeForm.post = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:196
* @route '/app/server-users/{server}/users/{user}/keys'
*/
export const destroy = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/app/server-users/{server}/users/{user}/keys',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:196
* @route '/app/server-users/{server}/users/{user}/keys'
*/
destroy.url = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            server: args[0],
            user: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        server: typeof args.server === 'object'
        ? args.server.id
        : args.server,
        user: args.user,
    }

    return destroy.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace('{user}', parsedArgs.user.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:196
* @route '/app/server-users/{server}/users/{user}/keys'
*/
destroy.delete = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:196
* @route '/app/server-users/{server}/users/{user}/keys'
*/
const destroyForm = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see app/Http/Controllers/ServerUserController.php:196
* @route '/app/server-users/{server}/users/{user}/keys'
*/
destroyForm.delete = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const keys = {
    store: Object.assign(store, store),
    destroy: Object.assign(destroy, destroy),
}

export default keys