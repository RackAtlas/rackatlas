@extends('errors.page')

@section('code', '429')
@section('tone', 'warn')
@section('title', __('Too many requests'))
@section('message', __('Slow down a little and try again in a moment.'))

@section('actions')
    <a class="btn primary" href="javascript:location.reload()">{{ __('Try again') }}</a>
    <a class="btn" href="/">{{ __('Back to home') }}</a>
@endsection
