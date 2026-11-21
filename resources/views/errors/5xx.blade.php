@extends('errors.page')

@section('code', '500')
@section('tone', 'bad')
@section('title', __('Something went wrong'))
@section('message', __('It is an error on our side, not yours. Try again in a moment.'))

@section('actions')
    <a class="btn primary" href="javascript:location.reload()">{{ __('Try again') }}</a>
    <a class="btn" href="/">{{ __('Back to home') }}</a>
@endsection
