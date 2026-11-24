import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::store
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:13
* @route '/app/terminal/snippets'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/app/terminal/snippets',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::store
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:13
* @route '/app/terminal/snippets'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::store
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:13
* @route '/app/terminal/snippets'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::store
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:13
* @route '/app/terminal/snippets'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::store
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:13
* @route '/app/terminal/snippets'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::update
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:25
* @route '/app/terminal/snippets/{snippet}'
*/
export const update = (args: { snippet: string | number | { id: string | number } } | [snippet: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/app/terminal/snippets/{snippet}',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::update
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:25
* @route '/app/terminal/snippets/{snippet}'
*/
update.url = (args: { snippet: string | number | { id: string | number } } | [snippet: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { snippet: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { snippet: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            snippet: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        snippet: typeof args.snippet === 'object'
        ? args.snippet.id
        : args.snippet,
    }

    return update.definition.url
            .replace('{snippet}', parsedArgs.snippet.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::update
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:25
* @route '/app/terminal/snippets/{snippet}'
*/
update.put = (args: { snippet: string | number | { id: string | number } } | [snippet: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::update
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:25
* @route '/app/terminal/snippets/{snippet}'
*/
const updateForm = (args: { snippet: string | number | { id: string | number } } | [snippet: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::update
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:25
* @route '/app/terminal/snippets/{snippet}'
*/
updateForm.put = (args: { snippet: string | number | { id: string | number } } | [snippet: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::destroy
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:36
* @route '/app/terminal/snippets/{snippet}'
*/
export const destroy = (args: { snippet: string | number | { id: string | number } } | [snippet: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/app/terminal/snippets/{snippet}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::destroy
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:36
* @route '/app/terminal/snippets/{snippet}'
*/
destroy.url = (args: { snippet: string | number | { id: string | number } } | [snippet: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { snippet: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { snippet: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            snippet: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        snippet: typeof args.snippet === 'object'
        ? args.snippet.id
        : args.snippet,
    }

    return destroy.definition.url
            .replace('{snippet}', parsedArgs.snippet.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::destroy
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:36
* @route '/app/terminal/snippets/{snippet}'
*/
destroy.delete = (args: { snippet: string | number | { id: string | number } } | [snippet: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::destroy
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:36
* @route '/app/terminal/snippets/{snippet}'
*/
const destroyForm = (args: { snippet: string | number | { id: string | number } } | [snippet: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Terminal\TerminalSnippetController::destroy
* @see app/Http/Controllers/Terminal/TerminalSnippetController.php:36
* @route '/app/terminal/snippets/{snippet}'
*/
destroyForm.delete = (args: { snippet: string | number | { id: string | number } } | [snippet: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const snippets = {
    store: Object.assign(store, store),
    update: Object.assign(update, update),
    destroy: Object.assign(destroy, destroy),
}

export default snippets