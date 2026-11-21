@extends('errors.page')

@section('code', '419')
@section('tone', 'warn')
@section('title', __('Session expired'))
@section('message', __('The page was open for too long. Reload it and try again.'))

@section('actions')
    <a class="btn primary" href="javascript:location.reload()">{{ __('Reload page') }}</a>
    <a class="btn" href="/">{{ __('Back to home') }}</a>
@endsection
