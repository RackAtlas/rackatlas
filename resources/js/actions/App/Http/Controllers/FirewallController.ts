import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\FirewallController::index
* @see app/Http/Controllers/FirewallController.php:24
* @route '/app/firewall'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/app/firewall',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\FirewallController::index
* @see app/Http/Controllers/FirewallController.php:24
* @route '/app/firewall'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\FirewallController::index
* @see app/Http/Controllers/FirewallController.php:24
* @route '/app/firewall'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FirewallController::index
* @see app/Http/Controllers/FirewallController.php:24
* @route '/app/firewall'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\FirewallController::index
* @see app/Http/Controllers/FirewallController.php:24
* @route '/app/firewall'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FirewallController::index
* @see app/Http/Controllers/FirewallController.php:24
* @route '/app/firewall'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FirewallController::index
* @see app/Http/Controllers/FirewallController.php:24
* @route '/app/firewall'
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
* @see \App\Http\Controllers\FirewallController::show
* @see app/Http/Controllers/FirewallController.php:36
* @route '/app/firewall/{server}'
*/
export const show = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: show.url(args, options),
    method: 'post',
})

show.definition = {
    methods: ["post"],
    url: '/app/firewall/{server}',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FirewallController::show
* @see app/Http/Controllers/FirewallController.php:36
* @route '/app/firewall/{server}'
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
* @see \App\Http\Controllers\FirewallController::show
* @see app/Http/Controllers/FirewallController.php:36
* @route '/app/firewall/{server}'
*/
show.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: show.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::show
* @see app/Http/Controllers/FirewallController.php:36
* @route '/app/firewall/{server}'
*/
const showForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: show.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::show
* @see app/Http/Controllers/FirewallController.php:36
* @route '/app/firewall/{server}'
*/
showForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: show.url(args, options),
    method: 'post',
})

show.form = showForm

/**
* @see \App\Http\Controllers\FirewallController::storeRule
* @see app/Http/Controllers/FirewallController.php:43
* @route '/app/firewall/{server}/rules'
*/
export const storeRule = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: storeRule.url(args, options),
    method: 'post',
})

storeRule.definition = {
    methods: ["post"],
    url: '/app/firewall/{server}/rules',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FirewallController::storeRule
* @see app/Http/Controllers/FirewallController.php:43
* @route '/app/firewall/{server}/rules'
*/
storeRule.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return storeRule.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FirewallController::storeRule
* @see app/Http/Controllers/FirewallController.php:43
* @route '/app/firewall/{server}/rules'
*/
storeRule.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: storeRule.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::storeRule
* @see app/Http/Controllers/FirewallController.php:43
* @route '/app/firewall/{server}/rules'
*/
const storeRuleForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: storeRule.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::storeRule
* @see app/Http/Controllers/FirewallController.php:43
* @route '/app/firewall/{server}/rules'
*/
storeRuleForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: storeRule.url(args, options),
    method: 'post',
})

storeRule.form = storeRuleForm

/**
* @see \App\Http\Controllers\FirewallController::destroyRule
* @see app/Http/Controllers/FirewallController.php:88
* @route '/app/firewall/{server}/rules'
*/
export const destroyRule = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroyRule.url(args, options),
    method: 'delete',
})

destroyRule.definition = {
    methods: ["delete"],
    url: '/app/firewall/{server}/rules',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\FirewallController::destroyRule
* @see app/Http/Controllers/FirewallController.php:88
* @route '/app/firewall/{server}/rules'
*/
destroyRule.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return destroyRule.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FirewallController::destroyRule
* @see app/Http/Controllers/FirewallController.php:88
* @route '/app/firewall/{server}/rules'
*/
destroyRule.delete = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroyRule.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\FirewallController::destroyRule
* @see app/Http/Controllers/FirewallController.php:88
* @route '/app/firewall/{server}/rules'
*/
const destroyRuleForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroyRule.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::destroyRule
* @see app/Http/Controllers/FirewallController.php:88
* @route '/app/firewall/{server}/rules'
*/
destroyRuleForm.delete = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroyRule.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroyRule.form = destroyRuleForm

/**
* @see \App\Http\Controllers\FirewallController::toggle
* @see app/Http/Controllers/FirewallController.php:107
* @route '/app/firewall/{server}/enabled'
*/
export const toggle = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: toggle.url(args, options),
    method: 'put',
})

toggle.definition = {
    methods: ["put"],
    url: '/app/firewall/{server}/enabled',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\FirewallController::toggle
* @see app/Http/Controllers/FirewallController.php:107
* @route '/app/firewall/{server}/enabled'
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
* @see \App\Http\Controllers\FirewallController::toggle
* @see app/Http/Controllers/FirewallController.php:107
* @route '/app/firewall/{server}/enabled'
*/
toggle.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: toggle.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\FirewallController::toggle
* @see app/Http/Controllers/FirewallController.php:107
* @route '/app/firewall/{server}/enabled'
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
* @see \App\Http\Controllers\FirewallController::toggle
* @see app/Http/Controllers/FirewallController.php:107
* @route '/app/firewall/{server}/enabled'
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
* @see \App\Http\Controllers\FirewallController::defaults
* @see app/Http/Controllers/FirewallController.php:125
* @route '/app/firewall/{server}/defaults'
*/
export const defaults = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: defaults.url(args, options),
    method: 'put',
})

defaults.definition = {
    methods: ["put"],
    url: '/app/firewall/{server}/defaults',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\FirewallController::defaults
* @see app/Http/Controllers/FirewallController.php:125
* @route '/app/firewall/{server}/defaults'
*/
defaults.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return defaults.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FirewallController::defaults
* @see app/Http/Controllers/FirewallController.php:125
* @route '/app/firewall/{server}/defaults'
*/
defaults.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: defaults.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\FirewallController::defaults
* @see app/Http/Controllers/FirewallController.php:125
* @route '/app/firewall/{server}/defaults'
*/
const defaultsForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: defaults.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::defaults
* @see app/Http/Controllers/FirewallController.php:125
* @route '/app/firewall/{server}/defaults'
*/
defaultsForm.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: defaults.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

defaults.form = defaultsForm

/**
* @see \App\Http\Controllers\FirewallController::logging
* @see app/Http/Controllers/FirewallController.php:144
* @route '/app/firewall/{server}/logging'
*/
export const logging = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: logging.url(args, options),
    method: 'put',
})

logging.definition = {
    methods: ["put"],
    url: '/app/firewall/{server}/logging',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\FirewallController::logging
* @see app/Http/Controllers/FirewallController.php:144
* @route '/app/firewall/{server}/logging'
*/
logging.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return logging.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FirewallController::logging
* @see app/Http/Controllers/FirewallController.php:144
* @route '/app/firewall/{server}/logging'
*/
logging.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: logging.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\FirewallController::logging
* @see app/Http/Controllers/FirewallController.php:144
* @route '/app/firewall/{server}/logging'
*/
const loggingForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: logging.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::logging
* @see app/Http/Controllers/FirewallController.php:144
* @route '/app/firewall/{server}/logging'
*/
loggingForm.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: logging.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

logging.form = loggingForm

/**
* @see \App\Http\Controllers\FirewallController::reload
* @see app/Http/Controllers/FirewallController.php:159
* @route '/app/firewall/{server}/reload'
*/
export const reload = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: reload.url(args, options),
    method: 'post',
})

reload.definition = {
    methods: ["post"],
    url: '/app/firewall/{server}/reload',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FirewallController::reload
* @see app/Http/Controllers/FirewallController.php:159
* @route '/app/firewall/{server}/reload'
*/
reload.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return reload.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FirewallController::reload
* @see app/Http/Controllers/FirewallController.php:159
* @route '/app/firewall/{server}/reload'
*/
reload.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: reload.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::reload
* @see app/Http/Controllers/FirewallController.php:159
* @route '/app/firewall/{server}/reload'
*/
const reloadForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: reload.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::reload
* @see app/Http/Controllers/FirewallController.php:159
* @route '/app/firewall/{server}/reload'
*/
reloadForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: reload.url(args, options),
    method: 'post',
})

reload.form = reloadForm

/**
* @see \App\Http\Controllers\FirewallController::confirm
* @see app/Http/Controllers/FirewallController.php:166
* @route '/app/firewall/{server}/confirm'
*/
export const confirm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: confirm.url(args, options),
    method: 'post',
})

confirm.definition = {
    methods: ["post"],
    url: '/app/firewall/{server}/confirm',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FirewallController::confirm
* @see app/Http/Controllers/FirewallController.php:166
* @route '/app/firewall/{server}/confirm'
*/
confirm.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return confirm.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FirewallController::confirm
* @see app/Http/Controllers/FirewallController.php:166
* @route '/app/firewall/{server}/confirm'
*/
confirm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: confirm.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::confirm
* @see app/Http/Controllers/FirewallController.php:166
* @route '/app/firewall/{server}/confirm'
*/
const confirmForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: confirm.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::confirm
* @see app/Http/Controllers/FirewallController.php:166
* @route '/app/firewall/{server}/confirm'
*/
confirmForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: confirm.url(args, options),
    method: 'post',
})

confirm.form = confirmForm

/**
* @see \App\Http\Controllers\FirewallController::rollback
* @see app/Http/Controllers/FirewallController.php:179
* @route '/app/firewall/{server}/rollback'
*/
export const rollback = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: rollback.url(args, options),
    method: 'post',
})

rollback.definition = {
    methods: ["post"],
    url: '/app/firewall/{server}/rollback',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FirewallController::rollback
* @see app/Http/Controllers/FirewallController.php:179
* @route '/app/firewall/{server}/rollback'
*/
rollback.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return rollback.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FirewallController::rollback
* @see app/Http/Controllers/FirewallController.php:179
* @route '/app/firewall/{server}/rollback'
*/
rollback.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: rollback.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::rollback
* @see app/Http/Controllers/FirewallController.php:179
* @route '/app/firewall/{server}/rollback'
*/
const rollbackForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: rollback.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::rollback
* @see app/Http/Controllers/FirewallController.php:179
* @route '/app/firewall/{server}/rollback'
*/
rollbackForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: rollback.url(args, options),
    method: 'post',
})

rollback.form = rollbackForm

/**
* @see \App\Http\Controllers\FirewallController::fail2ban
* @see app/Http/Controllers/FirewallController.php:192
* @route '/app/firewall/{server}/fail2ban'
*/
export const fail2ban = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: fail2ban.url(args, options),
    method: 'post',
})

fail2ban.definition = {
    methods: ["post"],
    url: '/app/firewall/{server}/fail2ban',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FirewallController::fail2ban
* @see app/Http/Controllers/FirewallController.php:192
* @route '/app/firewall/{server}/fail2ban'
*/
fail2ban.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return fail2ban.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FirewallController::fail2ban
* @see app/Http/Controllers/FirewallController.php:192
* @route '/app/firewall/{server}/fail2ban'
*/
fail2ban.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: fail2ban.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::fail2ban
* @see app/Http/Controllers/FirewallController.php:192
* @route '/app/firewall/{server}/fail2ban'
*/
const fail2banForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: fail2ban.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FirewallController::fail2ban
* @see app/Http/Controllers/FirewallController.php:192
* @route '/app/firewall/{server}/fail2ban'
*/
fail2banForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: fail2ban.url(args, options),
    method: 'post',
})

fail2ban.form = fail2banForm

const FirewallController = { index, show, storeRule, destroyRule, toggle, defaults, logging, reload, confirm, rollback, fail2ban }

export default FirewallController