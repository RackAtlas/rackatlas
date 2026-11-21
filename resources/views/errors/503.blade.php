{{-- Shown while "php artisan down" is on (a deploy). A visitor of a deploy has no cookie of the app yet, so the language comes from the browser. --}}
@php
    $browserLocale = collect(request()->getLanguages())
        ->map(fn (string $language) => strtolower(substr($language, 0, 2)))
        ->first(fn (string $language) => array_key_exists($language, config('app.supported_locales')));

    if ($browserLocale !== null) {
        app()->setLocale($browserLocale);
    }
@endphp
@extends('errors.page')

@section('code', '503')
@section('tone', 'warn')
@section('eyebrow', __('Maintenance'))
@section('title', __('We are updating RackAtlas'))
@section('message', __('A new version is being installed. It only takes a moment and this page reloads on its own.'))
@section('refresh', '15')
@section('actions')
    <a class="btn primary" href="javascript:location.reload()">{{ __('Try again') }}</a>
@endsection
