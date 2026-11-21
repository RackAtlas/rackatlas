@extends('errors.page')

@section('code', (string) $exception->getStatusCode())
@section('tone', 'warn')
@section('title', __('Request failed'))
@section('message', __('The server could not process this request.'))
