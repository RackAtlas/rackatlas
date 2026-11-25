import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\FileManagerController::index
* @see app/Http/Controllers/FileManagerController.php:29
* @route '/app/files'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/app/files',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\FileManagerController::index
* @see app/Http/Controllers/FileManagerController.php:29
* @route '/app/files'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::index
* @see app/Http/Controllers/FileManagerController.php:29
* @route '/app/files'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FileManagerController::index
* @see app/Http/Controllers/FileManagerController.php:29
* @route '/app/files'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\FileManagerController::index
* @see app/Http/Controllers/FileManagerController.php:29
* @route '/app/files'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FileManagerController::index
* @see app/Http/Controllers/FileManagerController.php:29
* @route '/app/files'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FileManagerController::index
* @see app/Http/Controllers/FileManagerController.php:29
* @route '/app/files'
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
* @see \App\Http\Controllers\FileManagerController::list
* @see app/Http/Controllers/FileManagerController.php:47
* @route '/app/files/{server}/list'
*/
export const list = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: list.url(args, options),
    method: 'post',
})

list.definition = {
    methods: ["post"],
    url: '/app/files/{server}/list',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FileManagerController::list
* @see app/Http/Controllers/FileManagerController.php:47
* @route '/app/files/{server}/list'
*/
list.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return list.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::list
* @see app/Http/Controllers/FileManagerController.php:47
* @route '/app/files/{server}/list'
*/
list.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: list.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::list
* @see app/Http/Controllers/FileManagerController.php:47
* @route '/app/files/{server}/list'
*/
const listForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: list.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::list
* @see app/Http/Controllers/FileManagerController.php:47
* @route '/app/files/{server}/list'
*/
listForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: list.url(args, options),
    method: 'post',
})

list.form = listForm

/**
* @see \App\Http\Controllers\FileManagerController::read
* @see app/Http/Controllers/FileManagerController.php:56
* @route '/app/files/{server}/read'
*/
export const read = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: read.url(args, options),
    method: 'post',
})

read.definition = {
    methods: ["post"],
    url: '/app/files/{server}/read',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FileManagerController::read
* @see app/Http/Controllers/FileManagerController.php:56
* @route '/app/files/{server}/read'
*/
read.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return read.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::read
* @see app/Http/Controllers/FileManagerController.php:56
* @route '/app/files/{server}/read'
*/
read.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: read.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::read
* @see app/Http/Controllers/FileManagerController.php:56
* @route '/app/files/{server}/read'
*/
const readForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: read.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::read
* @see app/Http/Controllers/FileManagerController.php:56
* @route '/app/files/{server}/read'
*/
readForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: read.url(args, options),
    method: 'post',
})

read.form = readForm

/**
* @see \App\Http\Controllers\FileManagerController::size
* @see app/Http/Controllers/FileManagerController.php:225
* @route '/app/files/{server}/size'
*/
export const size = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: size.url(args, options),
    method: 'post',
})

size.definition = {
    methods: ["post"],
    url: '/app/files/{server}/size',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FileManagerController::size
* @see app/Http/Controllers/FileManagerController.php:225
* @route '/app/files/{server}/size'
*/
size.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return size.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::size
* @see app/Http/Controllers/FileManagerController.php:225
* @route '/app/files/{server}/size'
*/
size.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: size.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::size
* @see app/Http/Controllers/FileManagerController.php:225
* @route '/app/files/{server}/size'
*/
const sizeForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: size.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::size
* @see app/Http/Controllers/FileManagerController.php:225
* @route '/app/files/{server}/size'
*/
sizeForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: size.url(args, options),
    method: 'post',
})

size.form = sizeForm

/**
* @see \App\Http\Controllers\FileManagerController::search
* @see app/Http/Controllers/FileManagerController.php:212
* @route '/app/files/{server}/search'
*/
export const search = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: search.url(args, options),
    method: 'post',
})

search.definition = {
    methods: ["post"],
    url: '/app/files/{server}/search',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FileManagerController::search
* @see app/Http/Controllers/FileManagerController.php:212
* @route '/app/files/{server}/search'
*/
search.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return search.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::search
* @see app/Http/Controllers/FileManagerController.php:212
* @route '/app/files/{server}/search'
*/
search.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: search.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::search
* @see app/Http/Controllers/FileManagerController.php:212
* @route '/app/files/{server}/search'
*/
const searchForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: search.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::search
* @see app/Http/Controllers/FileManagerController.php:212
* @route '/app/files/{server}/search'
*/
searchForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: search.url(args, options),
    method: 'post',
})

search.form = searchForm

/**
* @see \App\Http\Controllers\FileManagerController::validateConfig
* @see app/Http/Controllers/FileManagerController.php:234
* @route '/app/files/{server}/validate'
*/
export const validateConfig = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: validateConfig.url(args, options),
    method: 'post',
})

validateConfig.definition = {
    methods: ["post"],
    url: '/app/files/{server}/validate',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FileManagerController::validateConfig
* @see app/Http/Controllers/FileManagerController.php:234
* @route '/app/files/{server}/validate'
*/
validateConfig.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return validateConfig.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::validateConfig
* @see app/Http/Controllers/FileManagerController.php:234
* @route '/app/files/{server}/validate'
*/
validateConfig.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: validateConfig.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::validateConfig
* @see app/Http/Controllers/FileManagerController.php:234
* @route '/app/files/{server}/validate'
*/
const validateConfigForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: validateConfig.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::validateConfig
* @see app/Http/Controllers/FileManagerController.php:234
* @route '/app/files/{server}/validate'
*/
validateConfigForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: validateConfig.url(args, options),
    method: 'post',
})

validateConfig.form = validateConfigForm

/**
* @see \App\Http\Controllers\FileManagerController::download
* @see app/Http/Controllers/FileManagerController.php:243
* @route '/app/files/{server}/download'
*/
export const download = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: download.url(args, options),
    method: 'post',
})

download.definition = {
    methods: ["post"],
    url: '/app/files/{server}/download',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FileManagerController::download
* @see app/Http/Controllers/FileManagerController.php:243
* @route '/app/files/{server}/download'
*/
download.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return download.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::download
* @see app/Http/Controllers/FileManagerController.php:243
* @route '/app/files/{server}/download'
*/
download.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: download.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::download
* @see app/Http/Controllers/FileManagerController.php:243
* @route '/app/files/{server}/download'
*/
const downloadForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: download.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::download
* @see app/Http/Controllers/FileManagerController.php:243
* @route '/app/files/{server}/download'
*/
downloadForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: download.url(args, options),
    method: 'post',
})

download.form = downloadForm

/**
* @see \App\Http\Controllers\FileManagerController::save
* @see app/Http/Controllers/FileManagerController.php:65
* @route '/app/files/{server}/save'
*/
export const save = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: save.url(args, options),
    method: 'put',
})

save.definition = {
    methods: ["put"],
    url: '/app/files/{server}/save',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\FileManagerController::save
* @see app/Http/Controllers/FileManagerController.php:65
* @route '/app/files/{server}/save'
*/
save.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return save.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::save
* @see app/Http/Controllers/FileManagerController.php:65
* @route '/app/files/{server}/save'
*/
save.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: save.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\FileManagerController::save
* @see app/Http/Controllers/FileManagerController.php:65
* @route '/app/files/{server}/save'
*/
const saveForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: save.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::save
* @see app/Http/Controllers/FileManagerController.php:65
* @route '/app/files/{server}/save'
*/
saveForm.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: save.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

save.form = saveForm

/**
* @see \App\Http\Controllers\FileManagerController::create
* @see app/Http/Controllers/FileManagerController.php:90
* @route '/app/files/{server}/create'
*/
export const create = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: create.url(args, options),
    method: 'post',
})

create.definition = {
    methods: ["post"],
    url: '/app/files/{server}/create',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FileManagerController::create
* @see app/Http/Controllers/FileManagerController.php:90
* @route '/app/files/{server}/create'
*/
create.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return create.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::create
* @see app/Http/Controllers/FileManagerController.php:90
* @route '/app/files/{server}/create'
*/
create.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: create.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::create
* @see app/Http/Controllers/FileManagerController.php:90
* @route '/app/files/{server}/create'
*/
const createForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: create.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::create
* @see app/Http/Controllers/FileManagerController.php:90
* @route '/app/files/{server}/create'
*/
createForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: create.url(args, options),
    method: 'post',
})

create.form = createForm

/**
* @see \App\Http\Controllers\FileManagerController::move
* @see app/Http/Controllers/FileManagerController.php:109
* @route '/app/files/{server}/move'
*/
export const move = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: move.url(args, options),
    method: 'post',
})

move.definition = {
    methods: ["post"],
    url: '/app/files/{server}/move',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FileManagerController::move
* @see app/Http/Controllers/FileManagerController.php:109
* @route '/app/files/{server}/move'
*/
move.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return move.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::move
* @see app/Http/Controllers/FileManagerController.php:109
* @route '/app/files/{server}/move'
*/
move.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: move.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::move
* @see app/Http/Controllers/FileManagerController.php:109
* @route '/app/files/{server}/move'
*/
const moveForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: move.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::move
* @see app/Http/Controllers/FileManagerController.php:109
* @route '/app/files/{server}/move'
*/
moveForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: move.url(args, options),
    method: 'post',
})

move.form = moveForm

/**
* @see \App\Http\Controllers\FileManagerController::destroy
* @see app/Http/Controllers/FileManagerController.php:127
* @route '/app/files/{server}'
*/
export const destroy = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/app/files/{server}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\FileManagerController::destroy
* @see app/Http/Controllers/FileManagerController.php:127
* @route '/app/files/{server}'
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
* @see \App\Http\Controllers\FileManagerController::destroy
* @see app/Http/Controllers/FileManagerController.php:127
* @route '/app/files/{server}'
*/
destroy.delete = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\FileManagerController::destroy
* @see app/Http/Controllers/FileManagerController.php:127
* @route '/app/files/{server}'
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
* @see \App\Http\Controllers\FileManagerController::destroy
* @see app/Http/Controllers/FileManagerController.php:127
* @route '/app/files/{server}'
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
* @see \App\Http\Controllers\FileManagerController::permissions
* @see app/Http/Controllers/FileManagerController.php:142
* @route '/app/files/{server}/permissions'
*/
export const permissions = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: permissions.url(args, options),
    method: 'put',
})

permissions.definition = {
    methods: ["put"],
    url: '/app/files/{server}/permissions',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\FileManagerController::permissions
* @see app/Http/Controllers/FileManagerController.php:142
* @route '/app/files/{server}/permissions'
*/
permissions.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return permissions.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::permissions
* @see app/Http/Controllers/FileManagerController.php:142
* @route '/app/files/{server}/permissions'
*/
permissions.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: permissions.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\FileManagerController::permissions
* @see app/Http/Controllers/FileManagerController.php:142
* @route '/app/files/{server}/permissions'
*/
const permissionsForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: permissions.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::permissions
* @see app/Http/Controllers/FileManagerController.php:142
* @route '/app/files/{server}/permissions'
*/
permissionsForm.put = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: permissions.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

permissions.form = permissionsForm

/**
* @see \App\Http\Controllers\FileManagerController::compress
* @see app/Http/Controllers/FileManagerController.php:177
* @route '/app/files/{server}/compress'
*/
export const compress = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: compress.url(args, options),
    method: 'post',
})

compress.definition = {
    methods: ["post"],
    url: '/app/files/{server}/compress',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FileManagerController::compress
* @see app/Http/Controllers/FileManagerController.php:177
* @route '/app/files/{server}/compress'
*/
compress.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return compress.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::compress
* @see app/Http/Controllers/FileManagerController.php:177
* @route '/app/files/{server}/compress'
*/
compress.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: compress.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::compress
* @see app/Http/Controllers/FileManagerController.php:177
* @route '/app/files/{server}/compress'
*/
const compressForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: compress.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::compress
* @see app/Http/Controllers/FileManagerController.php:177
* @route '/app/files/{server}/compress'
*/
compressForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: compress.url(args, options),
    method: 'post',
})

compress.form = compressForm

/**
* @see \App\Http\Controllers\FileManagerController::extract
* @see app/Http/Controllers/FileManagerController.php:197
* @route '/app/files/{server}/extract'
*/
export const extract = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: extract.url(args, options),
    method: 'post',
})

extract.definition = {
    methods: ["post"],
    url: '/app/files/{server}/extract',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FileManagerController::extract
* @see app/Http/Controllers/FileManagerController.php:197
* @route '/app/files/{server}/extract'
*/
extract.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return extract.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::extract
* @see app/Http/Controllers/FileManagerController.php:197
* @route '/app/files/{server}/extract'
*/
extract.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: extract.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::extract
* @see app/Http/Controllers/FileManagerController.php:197
* @route '/app/files/{server}/extract'
*/
const extractForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: extract.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::extract
* @see app/Http/Controllers/FileManagerController.php:197
* @route '/app/files/{server}/extract'
*/
extractForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: extract.url(args, options),
    method: 'post',
})

extract.form = extractForm

/**
* @see \App\Http\Controllers\FileManagerController::upload
* @see app/Http/Controllers/FileManagerController.php:267
* @route '/app/files/{server}/upload'
*/
export const upload = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: upload.url(args, options),
    method: 'post',
})

upload.definition = {
    methods: ["post"],
    url: '/app/files/{server}/upload',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FileManagerController::upload
* @see app/Http/Controllers/FileManagerController.php:267
* @route '/app/files/{server}/upload'
*/
upload.url = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return upload.definition.url
            .replace('{server}', parsedArgs.server.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FileManagerController::upload
* @see app/Http/Controllers/FileManagerController.php:267
* @route '/app/files/{server}/upload'
*/
upload.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: upload.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::upload
* @see app/Http/Controllers/FileManagerController.php:267
* @route '/app/files/{server}/upload'
*/
const uploadForm = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: upload.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FileManagerController::upload
* @see app/Http/Controllers/FileManagerController.php:267
* @route '/app/files/{server}/upload'
*/
uploadForm.post = (args: { server: number | { id: number } } | [server: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: upload.url(args, options),
    method: 'post',
})

upload.form = uploadForm

const FileManagerController = { index, list, read, size, search, validateConfig, download, save, create, move, destroy, permissions, compress, extract, upload }

export default FileManagerController