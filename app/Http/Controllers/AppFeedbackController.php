<?php

namespace App\Http\Controllers;

use App\Http\Requests\AppFeedbackRequest;
use App\Mail\FeedbackMail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Mail;

class AppFeedbackController extends Controller
{
    /**
     * Take feedback from a signed-in user and pass it on by email.
     * The name and the address come from the account, so replying reaches the user.
     */
    public function __invoke(AppFeedbackRequest $request): RedirectResponse
    {
        $to = config('services.feedback.to');

        if (is_string($to) && $to !== '') {
            $user = $request->user();

            Mail::to($to)->send(new FeedbackMail(
                $user->name,
                $user->email,
                $request->string('message')->trim()->toString(),
                app()->getLocale(),
            ));
        }

        return back();
    }
}
