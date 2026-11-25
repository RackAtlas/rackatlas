import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
import keys from './keys'
import groups from './groups'
import sessions from './sessions'
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

const serverUsers = {
    index: Object.assign(index, index),
    show: Object.assign(show, show),
    store: Object.assign(store, store),
    update: Object.assign(update, update),
    destroy: Object.assign(destroy, destroy),
    enabled: Object.assign(enabled, enabled),
    password: Object.assign(password, password),
    keys: Object.assign(keys, keys),
    groups: Object.assign(groups, groups),
    sessions: Object.assign(sessions, sessions),
    sshd: Object.assign(sshd, sshd),
}

export default serverUsers