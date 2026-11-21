@extends('errors.page')

@section('code', '401')
@section('tone', 'warn')
@section('title', __('Sign in required'))
@section('message', __('Sign in to continue.'))

@section('actions')
    <a class="btn primary" href="/login">{{ __('Sign in') }}</a>
    <a class="btn" href="/">{{ __('Back to home') }}</a>
@endsection
