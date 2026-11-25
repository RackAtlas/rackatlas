import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\ServerUserController::index
* @see app/Http/Controllers/ServerUserController.php:25
* @route '/app/server-users'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/app/server-users',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ServerUserController::index
* @see app/Http/Controllers/ServerUserController.php:25
* @route '/app/server-users'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::index
* @see app/Http/Controllers/ServerUserController.php:25
* @route '/app/server-users'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ServerUserController::index
* @see app/Http/Controllers/ServerUserController.php:25
* @route '/app/server-users'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ServerUserController::index
* @see app/Http/Controllers/ServerUserController.php:25
* @route '/app/server-users'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ServerUserController::index
* @see app/Http/Controllers/ServerUserController.php:25
* @route '/app/server-users'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ServerUserController::index
* @see app/Http/Controllers/ServerUserController.php:25
* @route '/app/server-users'
*/
indexForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

index.form = indexForm

/**
* @see \App\Http\Controllers\ServerUserController::show
* @see app/Http/Controllers/ServerUserController.php:41
* @route '/app/server-users/{server}'
*/
export const show = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: show.url(args, options),
    method: 'post',
})

show.definition = {
    methods: ["post"],
    url: '/app/server-users/{server}',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ServerUserController::show
* @see app/Http/Controllers/ServerUserController.php:41
* @route '/app/server-users/{server}'
*/
show.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return show.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::show
* @see app/Http/Controllers/ServerUserController.php:41
* @route '/app/server-users/{server}'
*/
show.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: show.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::show
* @see app/Http/Controllers/ServerUserController.php:41
* @route '/app/server-users/{server}'
*/
const showForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: show.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::show
* @see app/Http/Controllers/ServerUserController.php:41
* @route '/app/server-users/{server}'
*/
showForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: show.url(args, options),
    method: 'post',
})

show.form = showForm

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:48
* @route '/app/server-users/{server}/users'
*/
export const store = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/app/server-users/{server}/users',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:48
* @route '/app/server-users/{server}/users'
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
* @see app/Http/Controllers/ServerUserController.php:48
* @route '/app/server-users/{server}/users'
*/
store.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:48
* @route '/app/server-users/{server}/users'
*/
const storeForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::store
* @see app/Http/Controllers/ServerUserController.php:48
* @route '/app/server-users/{server}/users'
*/
storeForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\ServerUserController::update
* @see app/Http/Controllers/ServerUserController.php:88
* @route '/app/server-users/{server}/users/{user}'
*/
export const update = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/app/server-users/{server}/users/{user}',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\ServerUserController::update
* @see app/Http/Controllers/ServerUserController.php:88
* @route '/app/server-users/{server}/users/{user}'
*/
update.url = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions) => {
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

    return update.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace('{user}', parsedArgs.user.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::update
* @see app/Http/Controllers/ServerUserController.php:88
* @route '/app/server-users/{server}/users/{user}'
*/
update.put = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\ServerUserController::update
* @see app/Http/Controllers/ServerUserController.php:88
* @route '/app/server-users/{server}/users/{user}'
*/
const updateForm = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::update
* @see app/Http/Controllers/ServerUserController.php:88
* @route '/app/server-users/{server}/users/{user}'
*/
updateForm.put = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

update.form = updateForm

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:115
* @route '/app/server-users/{server}/users/{user}'
*/
export const destroy = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/app/server-users/{server}/users/{user}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:115
* @route '/app/server-users/{server}/users/{user}'
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
* @see app/Http/Controllers/ServerUserController.php:115
* @route '/app/server-users/{server}/users/{user}'
*/
destroy.delete = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\ServerUserController::destroy
* @see app/Http/Controllers/ServerUserController.php:115
* @route '/app/server-users/{server}/users/{user}'
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
* @see app/Http/Controllers/ServerUserController.php:115
* @route '/app/server-users/{server}/users/{user}'
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

/**
* @see \App\Http\Controllers\ServerUserController::enabled
* @see app/Http/Controllers/ServerUserController.php:131
* @route '/app/server-users/{server}/users/{user}/enabled'
*/
export const enabled = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: enabled.url(args, options),
    method: 'put',
})

enabled.definition = {
    methods: ["put"],
    url: '/app/server-users/{server}/users/{user}/enabled',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\ServerUserController::enabled
* @see app/Http/Controllers/ServerUserController.php:131
* @route '/app/server-users/{server}/users/{user}/enabled'
*/
enabled.url = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions) => {
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

    return enabled.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace('{user}', parsedArgs.user.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::enabled
* @see app/Http/Controllers/ServerUserController.php:131
* @route '/app/server-users/{server}/users/{user}/enabled'
*/
enabled.put = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: enabled.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\ServerUserController::enabled
* @see app/Http/Controllers/ServerUserController.php:131
* @route '/app/server-users/{server}/users/{user}/enabled'
*/
const enabledForm = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: enabled.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::enabled
* @see app/Http/Controllers/ServerUserController.php:131
* @route '/app/server-users/{server}/users/{user}/enabled'
*/
enabledForm.put = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: enabled.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

enabled.form = enabledForm

/**
* @see \App\Http\Controllers\ServerUserController::password
* @see app/Http/Controllers/ServerUserController.php:147
* @route '/app/server-users/{server}/users/{user}/password'
*/
export const password = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: password.url(args, options),
    method: 'put',
})

password.definition = {
    methods: ["put"],
    url: '/app/server-users/{server}/users/{user}/password',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\ServerUserController::password
* @see app/Http/Controllers/ServerUserController.php:147
* @route '/app/server-users/{server}/users/{user}/password'
*/
password.url = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions) => {
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

    return password.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace('{user}', parsedArgs.user.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::password
* @see app/Http/Controllers/ServerUserController.php:147
* @route '/app/server-users/{server}/users/{user}/password'
*/
password.put = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: password.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\ServerUserController::password
* @see app/Http/Controllers/ServerUserController.php:147
* @route '/app/server-users/{server}/users/{user}/password'
*/
const passwordForm = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: password.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::password
* @see app/Http/Controllers/ServerUserController.php:147
* @route '/app/server-users/{server}/users/{user}/password'
*/
passwordForm.put = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: password.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

password.form = passwordForm

/**
* @see \App\Http\Controllers\ServerUserController::storeKey
* @see app/Http/Controllers/ServerUserController.php:177
* @route '/app/server-users/{server}/users/{user}/keys'
*/
export const storeKey = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: storeKey.url(args, options),
    method: 'post',
})

storeKey.definition = {
    methods: ["post"],
    url: '/app/server-users/{server}/users/{user}/keys',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ServerUserController::storeKey
* @see app/Http/Controllers/ServerUserController.php:177
* @route '/app/server-users/{server}/users/{user}/keys'
*/
storeKey.url = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions) => {
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

    return storeKey.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace('{user}', parsedArgs.user.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::storeKey
* @see app/Http/Controllers/ServerUserController.php:177
* @route '/app/server-users/{server}/users/{user}/keys'
*/
storeKey.post = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: storeKey.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::storeKey
* @see app/Http/Controllers/ServerUserController.php:177
* @route '/app/server-users/{server}/users/{user}/keys'
*/
const storeKeyForm = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: storeKey.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::storeKey
* @see app/Http/Controllers/ServerUserController.php:177
* @route '/app/server-users/{server}/users/{user}/keys'
*/
storeKeyForm.post = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: storeKey.url(args, options),
    method: 'post',
})

storeKey.form = storeKeyForm

/**
* @see \App\Http\Controllers\ServerUserController::destroyKey
* @see app/Http/Controllers/ServerUserController.php:196
* @route '/app/server-users/{server}/users/{user}/keys'
*/
export const destroyKey = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroyKey.url(args, options),
    method: 'delete',
})

destroyKey.definition = {
    methods: ["delete"],
    url: '/app/server-users/{server}/users/{user}/keys',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\ServerUserController::destroyKey
* @see app/Http/Controllers/ServerUserController.php:196
* @route '/app/server-users/{server}/users/{user}/keys'
*/
destroyKey.url = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions) => {
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

    return destroyKey.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace('{user}', parsedArgs.user.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::destroyKey
* @see app/Http/Controllers/ServerUserController.php:196
* @route '/app/server-users/{server}/users/{user}/keys'
*/
destroyKey.delete = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroyKey.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\ServerUserController::destroyKey
* @see app/Http/Controllers/ServerUserController.php:196
* @route '/app/server-users/{server}/users/{user}/keys'
*/
const destroyKeyForm = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroyKey.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::destroyKey
* @see app/Http/Controllers/ServerUserController.php:196
* @route '/app/server-users/{server}/users/{user}/keys'
*/
destroyKeyForm.delete = (args: { server: number | { id: number }, user: string | number } | [server: number | { id: number }, user: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroyKey.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroyKey.form = destroyKeyForm

/**
* @see \App\Http\Controllers\ServerUserController::storeGroup
* @see app/Http/Controllers/ServerUserController.php:212
* @route '/app/server-users/{server}/groups'
*/
export const storeGroup = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: storeGroup.url(args, options),
    method: 'post',
})

storeGroup.definition = {
    methods: ["post"],
    url: '/app/server-users/{server}/groups',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ServerUserController::storeGroup
* @see app/Http/Controllers/ServerUserController.php:212
* @route '/app/server-users/{server}/groups'
*/
storeGroup.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return storeGroup.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::storeGroup
* @see app/Http/Controllers/ServerUserController.php:212
* @route '/app/server-users/{server}/groups'
*/
storeGroup.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: storeGroup.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::storeGroup
* @see app/Http/Controllers/ServerUserController.php:212
* @route '/app/server-users/{server}/groups'
*/
const storeGroupForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: storeGroup.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::storeGroup
* @see app/Http/Controllers/ServerUserController.php:212
* @route '/app/server-users/{server}/groups'
*/
storeGroupForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: storeGroup.url(args, options),
    method: 'post',
})

storeGroup.form = storeGroupForm

/**
* @see \App\Http\Controllers\ServerUserController::destroyGroup
* @see app/Http/Controllers/ServerUserController.php:226
* @route '/app/server-users/{server}/groups/{group}'
*/
export const destroyGroup = (args: { server: number | { id: number }, group: string | number } | [server: number | { id: number }, group: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroyGroup.url(args, options),
    method: 'delete',
})

destroyGroup.definition = {
    methods: ["delete"],
    url: '/app/server-users/{server}/groups/{group}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\ServerUserController::destroyGroup
* @see app/Http/Controllers/ServerUserController.php:226
* @route '/app/server-users/{server}/groups/{group}'
*/
destroyGroup.url = (args: { server: number | { id: number }, group: string | number } | [server: number | { id: number }, group: string | number ], options?: RouteQueryOptions) => {
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

    return destroyGroup.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace('{group}', parsedArgs.group.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::destroyGroup
* @see app/Http/Controllers/ServerUserController.php:226
* @route '/app/server-users/{server}/groups/{group}'
*/
destroyGroup.delete = (args: { server: number | { id: number }, group: string | number } | [server: number | { id: number }, group: string | number ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroyGroup.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\ServerUserController::destroyGroup
* @see app/Http/Controllers/ServerUserController.php:226
* @route '/app/server-users/{server}/groups/{group}'
*/
const destroyGroupForm = (args: { server: number | { id: number }, group: string | number } | [server: number | { id: number }, group: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroyGroup.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::destroyGroup
* @see app/Http/Controllers/ServerUserController.php:226
* @route '/app/server-users/{server}/groups/{group}'
*/
destroyGroupForm.delete = (args: { server: number | { id: number }, group: string | number } | [server: number | { id: number }, group: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroyGroup.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroyGroup.form = destroyGroupForm

/**
* @see \App\Http\Controllers\ServerUserController::endSession
* @see app/Http/Controllers/ServerUserController.php:239
* @route '/app/server-users/{server}/sessions/end'
*/
export const endSession = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: endSession.url(args, options),
    method: 'post',
})

endSession.definition = {
    methods: ["post"],
    url: '/app/server-users/{server}/sessions/end',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ServerUserController::endSession
* @see app/Http/Controllers/ServerUserController.php:239
* @route '/app/server-users/{server}/sessions/end'
*/
endSession.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return endSession.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::endSession
* @see app/Http/Controllers/ServerUserController.php:239
* @route '/app/server-users/{server}/sessions/end'
*/
endSession.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: endSession.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::endSession
* @see app/Http/Controllers/ServerUserController.php:239
* @route '/app/server-users/{server}/sessions/end'
*/
const endSessionForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: endSession.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::endSession
* @see app/Http/Controllers/ServerUserController.php:239
* @route '/app/server-users/{server}/sessions/end'
*/
endSessionForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: endSession.url(args, options),
    method: 'post',
})

endSession.form = endSessionForm

/**
* @see \App\Http\Controllers\ServerUserController::sshd
* @see app/Http/Controllers/ServerUserController.php:253
* @route '/app/server-users/{server}/sshd'
*/
export const sshd = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: sshd.url(args, options),
    method: 'put',
})

sshd.definition = {
    methods: ["put"],
    url: '/app/server-users/{server}/sshd',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\ServerUserController::sshd
* @see app/Http/Controllers/ServerUserController.php:253
* @route '/app/server-users/{server}/sshd'
*/
sshd.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return sshd.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\ServerUserController::sshd
* @see app/Http/Controllers/ServerUserController.php:253
* @route '/app/server-users/{server}/sshd'
*/
sshd.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: sshd.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\ServerUserController::sshd
* @see app/Http/Controllers/ServerUserController.php:253
* @route '/app/server-users/{server}/sshd'
*/
const sshdForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: sshd.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ServerUserController::sshd
* @see app/Http/Controllers/ServerUserController.php:253
* @route '/app/server-users/{server}/sshd'
*/
sshdForm.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: sshd.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

sshd.form = sshdForm

const ServerUserController = { index, show, store, update, destroy, enabled, password, storeKey, destroyKey, storeGroup, destroyGroup, endSession, sshd }

export default ServerUserController