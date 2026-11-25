import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
/**
* @see \App\Http\Controllers\UpdateController::index
* @see app/Http/Controllers/UpdateController.php:21
* @route '/app/updates'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/app/updates',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\UpdateController::index
* @see app/Http/Controllers/UpdateController.php:21
* @route '/app/updates'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdateController::index
* @see app/Http/Controllers/UpdateController.php:21
* @route '/app/updates'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdateController::index
* @see app/Http/Controllers/UpdateController.php:21
* @route '/app/updates'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\UpdateController::index
* @see app/Http/Controllers/UpdateController.php:21
* @route '/app/updates'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdateController::index
* @see app/Http/Controllers/UpdateController.php:21
* @route '/app/updates'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\UpdateController::index
* @see app/Http/Controllers/UpdateController.php:21
* @route '/app/updates'
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
* @see \App\Http\Controllers\UpdateController::show
* @see app/Http/Controllers/UpdateController.php:33
* @route '/app/updates/{server}'
*/
export const show = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: show.url(args, options),
    method: 'post',
})

show.definition = {
    methods: ["post"],
    url: '/app/updates/{server}',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\UpdateController::show
* @see app/Http/Controllers/UpdateController.php:33
* @route '/app/updates/{server}'
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
* @see \App\Http\Controllers\UpdateController::show
* @see app/Http/Controllers/UpdateController.php:33
* @route '/app/updates/{server}'
*/
show.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: show.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdateController::show
* @see app/Http/Controllers/UpdateController.php:33
* @route '/app/updates/{server}'
*/
const showForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: show.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdateController::show
* @see app/Http/Controllers/UpdateController.php:33
* @route '/app/updates/{server}'
*/
showForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: show.url(args, options),
    method: 'post',
})

show.form = showForm

/**
* @see \App\Http\Controllers\UpdateController::job
* @see app/Http/Controllers/UpdateController.php:59
* @route '/app/updates/{server}/job'
*/
export const job = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: job.url(args, options),
    method: 'post',
})

job.definition = {
    methods: ["post"],
    url: '/app/updates/{server}/job',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\UpdateController::job
* @see app/Http/Controllers/UpdateController.php:59
* @route '/app/updates/{server}/job'
*/
job.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return job.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdateController::job
* @see app/Http/Controllers/UpdateController.php:59
* @route '/app/updates/{server}/job'
*/
job.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: job.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdateController::job
* @see app/Http/Controllers/UpdateController.php:59
* @route '/app/updates/{server}/job'
*/
const jobForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: job.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdateController::job
* @see app/Http/Controllers/UpdateController.php:59
* @route '/app/updates/{server}/job'
*/
jobForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: job.url(args, options),
    method: 'post',
})

job.form = jobForm

/**
* @see \App\Http\Controllers\UpdateController::start
* @see app/Http/Controllers/UpdateController.php:40
* @route '/app/updates/{server}/start'
*/
export const start = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: start.url(args, options),
    method: 'post',
})

start.definition = {
    methods: ["post"],
    url: '/app/updates/{server}/start',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\UpdateController::start
* @see app/Http/Controllers/UpdateController.php:40
* @route '/app/updates/{server}/start'
*/
start.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return start.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdateController::start
* @see app/Http/Controllers/UpdateController.php:40
* @route '/app/updates/{server}/start'
*/
start.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: start.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdateController::start
* @see app/Http/Controllers/UpdateController.php:40
* @route '/app/updates/{server}/start'
*/
const startForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: start.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdateController::start
* @see app/Http/Controllers/UpdateController.php:40
* @route '/app/updates/{server}/start'
*/
startForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: start.url(args, options),
    method: 'post',
})

start.form = startForm

/**
* @see \App\Http\Controllers\UpdateController::hold
* @see app/Http/Controllers/UpdateController.php:66
* @route '/app/updates/{server}/hold'
*/
export const hold = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: hold.url(args, options),
    method: 'put',
})

hold.definition = {
    methods: ["put"],
    url: '/app/updates/{server}/hold',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\UpdateController::hold
* @see app/Http/Controllers/UpdateController.php:66
* @route '/app/updates/{server}/hold'
*/
hold.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return hold.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdateController::hold
* @see app/Http/Controllers/UpdateController.php:66
* @route '/app/updates/{server}/hold'
*/
hold.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: hold.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\UpdateController::hold
* @see app/Http/Controllers/UpdateController.php:66
* @route '/app/updates/{server}/hold'
*/
const holdForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: hold.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdateController::hold
* @see app/Http/Controllers/UpdateController.php:66
* @route '/app/updates/{server}/hold'
*/
holdForm.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: hold.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

hold.form = holdForm

/**
* @see \App\Http\Controllers\UpdateController::reboot
* @see app/Http/Controllers/UpdateController.php:85
* @route '/app/updates/{server}/reboot'
*/
export const reboot = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: reboot.url(args, options),
    method: 'post',
})

reboot.definition = {
    methods: ["post"],
    url: '/app/updates/{server}/reboot',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\UpdateController::reboot
* @see app/Http/Controllers/UpdateController.php:85
* @route '/app/updates/{server}/reboot'
*/
reboot.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return reboot.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UpdateController::reboot
* @see app/Http/Controllers/UpdateController.php:85
* @route '/app/updates/{server}/reboot'
*/
reboot.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: reboot.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdateController::reboot
* @see app/Http/Controllers/UpdateController.php:85
* @route '/app/updates/{server}/reboot'
*/
const rebootForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: reboot.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UpdateController::reboot
* @see app/Http/Controllers/UpdateController.php:85
* @route '/app/updates/{server}/reboot'
*/
rebootForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: reboot.url(args, options),
    method: 'post',
})

reboot.form = rebootForm

const updates = {
    index: Object.assign(index, index),
    show: Object.assign(show, show),
    job: Object.assign(job, job),
    start: Object.assign(start, start),
    hold: Object.assign(hold, hold),
    reboot: Object.assign(reboot, reboot),
}

export default updates