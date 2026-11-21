<?php

namespace Tests\Feature;

use App\Mail\FeedbackMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AppFeedbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_signed_in_user_can_send_feedback(): void
    {
        Mail::fake();
        config(['services.feedback.to' => 'owner@example.com']);
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('app.feedback.store'), ['message' => 'Please add a dark map view.'])
            ->assertSessionHasNoErrors();

        Mail::assertSent(FeedbackMail::class, fn (FeedbackMail $mail) => $mail->hasTo('owner@example.com')
            && $mail->hasReplyTo($user->email)
            && $mail->name === $user->name
            && $mail->feedback === 'Please add a dark map view.');
    }

    public function test_the_message_is_required_and_long_enough(): void
    {
        Mail::fake();

        $this->actingAs(User::factory()->create())
            ->post(route('app.feedback.store'), ['message' => 'short'])
            ->assertSessionHasErrors('message');

        Mail::assertNothingSent();
    }

    public function test_guests_cannot_use_it(): void
    {
        Mail::fake();

        $this->post(route('app.feedback.store'), ['message' => 'A long enough message.'])
            ->assertRedirect();

        Mail::assertNothingSent();
    }

    public function test_the_demo_account_cannot_send_feedback(): void
    {
        Mail::fake();

        $this->actingAs(User::factory()->create(['is_demo' => true]))
            ->post(route('app.feedback.store'), ['message' => 'A long enough message.']);

        Mail::assertNothingSent();
    }
}
