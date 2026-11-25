import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\CronController::store
* @see app/Http/Controllers/CronController.php:59
* @route '/app/cron/{server}/jobs'
*/
export const store = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/app/cron/{server}/jobs',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CronController::store
* @see app/Http/Controllers/CronController.php:59
* @route '/app/cron/{server}/jobs'
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
* @see \App\Http\Controllers\CronController::store
* @see app/Http/Controllers/CronController.php:59
* @route '/app/cron/{server}/jobs'
*/
store.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::store
* @see app/Http/Controllers/CronController.php:59
* @route '/app/cron/{server}/jobs'
*/
const storeForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::store
* @see app/Http/Controllers/CronController.php:59
* @route '/app/cron/{server}/jobs'
*/
storeForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\CronController::update
* @see app/Http/Controllers/CronController.php:74
* @route '/app/cron/{server}/jobs'
*/
export const update = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/app/cron/{server}/jobs',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\CronController::update
* @see app/Http/Controllers/CronController.php:74
* @route '/app/cron/{server}/jobs'
*/
update.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return update.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CronController::update
* @see app/Http/Controllers/CronController.php:74
* @route '/app/cron/{server}/jobs'
*/
update.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\CronController::update
* @see app/Http/Controllers/CronController.php:74
* @route '/app/cron/{server}/jobs'
*/
const updateForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::update
* @see app/Http/Controllers/CronController.php:74
* @route '/app/cron/{server}/jobs'
*/
updateForm.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\CronController::toggle
* @see app/Http/Controllers/CronController.php:89
* @route '/app/cron/{server}/jobs/enabled'
*/
export const toggle = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: toggle.url(args, options),
    method: 'put',
})

toggle.definition = {
    methods: ["put"],
    url: '/app/cron/{server}/jobs/enabled',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\CronController::toggle
* @see app/Http/Controllers/CronController.php:89
* @route '/app/cron/{server}/jobs/enabled'
*/
toggle.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return toggle.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CronController::toggle
* @see app/Http/Controllers/CronController.php:89
* @route '/app/cron/{server}/jobs/enabled'
*/
toggle.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: toggle.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\CronController::toggle
* @see app/Http/Controllers/CronController.php:89
* @route '/app/cron/{server}/jobs/enabled'
*/
const toggleForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: toggle.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::toggle
* @see app/Http/Controllers/CronController.php:89
* @route '/app/cron/{server}/jobs/enabled'
*/
toggleForm.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: toggle.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

toggle.form = toggleForm

/**
* @see \App\Http\Controllers\CronController::destroy
* @see app/Http/Controllers/CronController.php:107
* @route '/app/cron/{server}/jobs'
*/
export const destroy = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/app/cron/{server}/jobs',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\CronController::destroy
* @see app/Http/Controllers/CronController.php:107
* @route '/app/cron/{server}/jobs'
*/
destroy.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return destroy.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CronController::destroy
* @see app/Http/Controllers/CronController.php:107
* @route '/app/cron/{server}/jobs'
*/
destroy.delete = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\CronController::destroy
* @see app/Http/Controllers/CronController.php:107
* @route '/app/cron/{server}/jobs'
*/
const destroyForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::destroy
* @see app/Http/Controllers/CronController.php:107
* @route '/app/cron/{server}/jobs'
*/
destroyForm.delete = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\CronController::run
* @see app/Http/Controllers/CronController.php:125
* @route '/app/cron/{server}/jobs/run'
*/
export const run = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: run.url(args, options),
    method: 'post',
})

run.definition = {
    methods: ["post"],
    url: '/app/cron/{server}/jobs/run',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CronController::run
* @see app/Http/Controllers/CronController.php:125
* @route '/app/cron/{server}/jobs/run'
*/
run.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return run.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CronController::run
* @see app/Http/Controllers/CronController.php:125
* @route '/app/cron/{server}/jobs/run'
*/
run.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: run.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::run
* @see app/Http/Controllers/CronController.php:125
* @route '/app/cron/{server}/jobs/run'
*/
const runForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: run.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CronController::run
* @see app/Http/Controllers/CronController.php:125
* @route '/app/cron/{server}/jobs/run'
*/
runForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: run.url(args, options),
    method: 'post',
})

run.form = runForm

const jobs = {
    store: Object.assign(store, store),
    update: Object.assign(update, update),
    toggle: Object.assign(toggle, toggle),
    destroy: Object.assign(destroy, destroy),
    run: Object.assign(run, run),
}

export default jobs